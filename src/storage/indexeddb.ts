import type {
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
  SyncMetadata,
} from "../types.js";
import {
  cloneLocalChange,
  cloneStoredRecord,
  cloneSyncMetadata,
} from "./shared.js";

type IndexedDbStorageOptions = {
  databaseName: string;
};

type StoredRecordRow = StoredEntityRecord<unknown> & {
  entityName: string;
  entityId: string;
};

type MetaRow = {
  key: string;
  value: number;
};

type ChangeRow = LocalChange & {
  key: string;
};

type DraftState = {
  records: Map<string, StoredRecordRow>;
  changes: ChangeRow[];
  syncMetadata: SyncMetadata;
  updatedOrder: number;
};

const DATABASE_VERSION = 1;
const ENTITY_STORE = "entities";
const CHANGE_STORE = "changes";
const META_STORE = "meta";
const UPDATED_ORDER_KEY = "updatedOrder";
const SYNC_METADATA_KEY = "syncMetadata";

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ENTITY_STORE)) {
        database.createObjectStore(ENTITY_STORE, {
          keyPath: ["entityName", "entityId"],
        });
      }

      if (!database.objectStoreNames.contains(CHANGE_STORE)) {
        database.createObjectStore(CHANGE_STORE, {
          keyPath: "key",
        });
      }

      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDraftState(database: IDBDatabase): Promise<DraftState> {
  const transaction = database.transaction(
    [ENTITY_STORE, CHANGE_STORE, META_STORE],
    "readonly",
  );
  const entityStore = transaction.objectStore(ENTITY_STORE);
  const changeStore = transaction.objectStore(CHANGE_STORE);
  const metaStore = transaction.objectStore(META_STORE);

  const rows = (await promisifyRequest(
    entityStore.getAll(),
  )) as StoredRecordRow[];
  const changes = (await promisifyRequest(changeStore.getAll())) as ChangeRow[];
  const meta = (await promisifyRequest(metaStore.get(UPDATED_ORDER_KEY))) as
    | MetaRow
    | undefined;
  const syncMetadataRow = (await promisifyRequest(
    metaStore.get(SYNC_METADATA_KEY),
  )) as
    | {
        key: string;
        value: SyncMetadata;
      }
    | undefined;

  await promisifyTransaction(transaction);

  return {
    records: new Map(
      rows.map((row) => [`${row.entityName}:${row.entityId}`, row]),
    ),
    changes,
    syncMetadata: cloneSyncMetadata(
      syncMetadataRow?.value ?? {
        observedRemoteChangeIds: [],
      },
    ),
    updatedOrder: meta?.value ?? 0,
  };
}

async function writeDraftState(
  database: IDBDatabase,
  original: DraftState,
  draft: DraftState,
): Promise<void> {
  const transaction = database.transaction(
    [ENTITY_STORE, CHANGE_STORE, META_STORE],
    "readwrite",
  );
  const entityStore = transaction.objectStore(ENTITY_STORE);
  const changeStore = transaction.objectStore(CHANGE_STORE);
  const metaStore = transaction.objectStore(META_STORE);

  for (const [key, record] of draft.records.entries()) {
    const previous = original.records.get(key);

    if (JSON.stringify(previous) !== JSON.stringify(record)) {
      entityStore.put(record);
    }
  }

  const originalChanges = new Map(
    original.changes.map((change) => [change.key, change]),
  );

  for (const change of draft.changes) {
    const previous = originalChanges.get(change.key);

    if (JSON.stringify(previous) !== JSON.stringify(change)) {
      changeStore.put(change);
    }
  }

  if (draft.updatedOrder !== original.updatedOrder) {
    metaStore.put({
      key: UPDATED_ORDER_KEY,
      value: draft.updatedOrder,
    } satisfies MetaRow);
  }

  if (
    JSON.stringify(original.syncMetadata) !== JSON.stringify(draft.syncMetadata)
  ) {
    metaStore.put({
      key: SYNC_METADATA_KEY,
      value: cloneSyncMetadata(draft.syncMetadata),
    });
  }

  await promisifyTransaction(transaction);
}

export function createIndexedDbStorage(
  options: IndexedDbStorageOptions,
): LocalStorageAdapter {
  const databasePromise = openDatabase(options.databaseName);

  return {
    async readEntity(entityName, entityId) {
      const database = await databasePromise;
      const draft = await readDraftState(database);
      const record = draft.records.get(`${entityName}:${entityId}`);

      return record ? cloneStoredRecord(record) : null;
    },

    async listEntities(entityName) {
      const database = await databasePromise;
      const draft = await readDraftState(database);

      return Array.from(draft.records.entries())
        .filter(([key]) => key.startsWith(`${entityName}:`))
        .map(
          ([key, row]): ListedEntityRecord => ({
            entityId: key.slice(entityName.length + 1),
            record: cloneStoredRecord(row),
          }),
        )
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async listChanges(entityName, entityId) {
      const database = await databasePromise;
      const draft = await readDraftState(database);

      return draft.changes
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map(cloneLocalChange);
    },

    async readSyncMetadata() {
      const database = await databasePromise;
      const draft = await readDraftState(database);
      return cloneSyncMetadata(draft.syncMetadata);
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const database = await databasePromise;
      const original = await readDraftState(database);
      const draft: DraftState = {
        records: new Map(original.records),
        changes: [...original.changes],
        syncMetadata: cloneSyncMetadata(original.syncMetadata),
        updatedOrder: original.updatedOrder,
      };

      const scopedTransaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          const row = draft.records.get(`${entityName}:${entityId}`);
          return row ? cloneStoredRecord(row) : null;
        },
        writeEntity(entityName, entityId, record) {
          draft.records.set(`${entityName}:${entityId}`, {
            entityName,
            entityId,
            ...record,
          });
        },
        appendChange(change) {
          draft.changes.push({
            key: `${change.entityName}:${change.entityId}:${change.changeId}`,
            ...change,
          });
        },
        markChangeEntityProjected(changeId) {
          draft.changes = draft.changes.map((change) =>
            change.changeId === changeId
              ? {
                  ...change,
                  entityProjected: true,
                }
              : change,
          );
        },
        markChangeLogProjected(changeId) {
          draft.changes = draft.changes.map((change) =>
            change.changeId === changeId
              ? {
                  ...change,
                  logProjected: true,
                }
              : change,
          );
        },
        readSyncMetadata() {
          return cloneSyncMetadata(draft.syncMetadata);
        },
        writeSyncMetadata(metadata) {
          draft.syncMetadata = cloneSyncMetadata(metadata);
        },
        nextUpdatedOrder() {
          draft.updatedOrder += 1;
          return draft.updatedOrder;
        },
      };

      const result = await work(scopedTransaction);
      await writeDraftState(database, original, draft);
      return result;
    },
  };
}
