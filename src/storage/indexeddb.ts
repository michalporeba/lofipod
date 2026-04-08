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
  value: number | SyncMetadata;
};

type ChangeRow = LocalChange & {
  key: string;
  pendingEntityProjected?: 0 | 1;
  pendingLogProjected?: 0 | 1;
};

type TransactionDraft = {
  records: Map<string, StoredRecordRow>;
  syncMetadata: SyncMetadata;
  updatedOrder: number;
};

const DATABASE_VERSION = 2;
const ENTITY_STORE = "entities";
const CHANGE_STORE = "changes";
const META_STORE = "meta";
const ENTITY_NAME_INDEX = "byEntityName";
const CHANGE_ENTITY_INDEX = "byEntity";
const CHANGE_PENDING_INDEX = "byPending";
const UPDATED_ORDER_KEY = "updatedOrder";
const SYNC_METADATA_KEY = "syncMetadata";

function createDefaultSyncMetadata(): SyncMetadata {
  return {
    observedRemoteChangeIds: [],
  };
}

function createChangeKey(change: LocalChange): string {
  return `${change.entityName}:${change.entityId}:${change.changeId}`;
}

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

function ensureEntityIndexes(store: IDBObjectStore): void {
  if (!store.indexNames.contains(ENTITY_NAME_INDEX)) {
    store.createIndex(ENTITY_NAME_INDEX, "entityName");
  }
}

function ensureChangeIndexes(store: IDBObjectStore): void {
  if (!store.indexNames.contains(CHANGE_ENTITY_INDEX)) {
    store.createIndex(CHANGE_ENTITY_INDEX, ["entityName", "entityId"]);
  }

  if (!store.indexNames.contains(CHANGE_PENDING_INDEX)) {
    store.createIndex(CHANGE_PENDING_INDEX, [
      "pendingEntityProjected",
      "pendingLogProjected",
    ]);
  }
}

function normalizeChangeRow(row: ChangeRow): ChangeRow {
  return {
    ...row,
    pendingEntityProjected: row.entityProjected ? 1 : 0,
    pendingLogProjected: row.logProjected ? 1 : 0,
  };
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction!;
      const entityStore = database.objectStoreNames.contains(ENTITY_STORE)
        ? transaction.objectStore(ENTITY_STORE)
        : database.createObjectStore(ENTITY_STORE, {
            keyPath: ["entityName", "entityId"],
          });
      const changeStore = database.objectStoreNames.contains(CHANGE_STORE)
        ? transaction.objectStore(CHANGE_STORE)
        : database.createObjectStore(CHANGE_STORE, {
            keyPath: "key",
          });
      const metaStore = database.objectStoreNames.contains(META_STORE)
        ? transaction.objectStore(META_STORE)
        : database.createObjectStore(META_STORE, {
            keyPath: "key",
          });

      ensureEntityIndexes(entityStore);
      ensureChangeIndexes(changeStore);

      if (!metaStore.indexNames.contains("byKey")) {
        metaStore.createIndex("byKey", "key");
      }

      if (event.oldVersion < 2 && database.objectStoreNames.contains(CHANGE_STORE)) {
        const cursorRequest = changeStore.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;

          if (!cursor) {
            return;
          }

          cursor.update(normalizeChangeRow(cursor.value as ChangeRow));
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function cloneStoredRecordRow(row: StoredRecordRow): StoredRecordRow {
  return {
    entityName: row.entityName,
    entityId: row.entityId,
    ...cloneStoredRecord(row),
  };
}

async function readEntityRows(database: IDBDatabase): Promise<StoredRecordRow[]> {
  const transaction = database.transaction([ENTITY_STORE], "readonly");
  const store = transaction.objectStore(ENTITY_STORE);
  const rows = (await promisifyRequest(store.getAll())) as StoredRecordRow[];

  await promisifyTransaction(transaction);
  return rows;
}

async function readUpdatedOrder(database: IDBDatabase): Promise<number> {
  const transaction = database.transaction([META_STORE], "readonly");
  const metaStore = transaction.objectStore(META_STORE);
  const row = (await promisifyRequest(metaStore.get(UPDATED_ORDER_KEY))) as
    | MetaRow
    | undefined;

  await promisifyTransaction(transaction);
  return typeof row?.value === "number" ? row.value : 0;
}

async function readSyncMetadataRow(database: IDBDatabase): Promise<SyncMetadata> {
  const transaction = database.transaction([META_STORE], "readonly");
  const metaStore = transaction.objectStore(META_STORE);
  const row = (await promisifyRequest(metaStore.get(SYNC_METADATA_KEY))) as
    | MetaRow
    | undefined;

  await promisifyTransaction(transaction);
  return cloneSyncMetadata(
    typeof row?.value === "object" && row.value
      ? (row.value as SyncMetadata)
      : createDefaultSyncMetadata(),
  );
}

export function createIndexedDbStorage(
  options: IndexedDbStorageOptions,
): LocalStorageAdapter {
  const databasePromise = openDatabase(options.databaseName);

  return {
    async readEntity(entityName, entityId) {
      const database = await databasePromise;
      const transaction = database.transaction([ENTITY_STORE], "readonly");
      const store = transaction.objectStore(ENTITY_STORE);
      const row = (await promisifyRequest(
        store.get([entityName, entityId]),
      )) as StoredRecordRow | undefined;

      await promisifyTransaction(transaction);
      return row ? cloneStoredRecord(row) : null;
    },

    async listEntities(entityName) {
      const database = await databasePromise;
      const transaction = database.transaction([ENTITY_STORE], "readonly");
      const store = transaction.objectStore(ENTITY_STORE);
      const index = store.index(ENTITY_NAME_INDEX);
      const rows = (await promisifyRequest(
        index.getAll(entityName),
      )) as StoredRecordRow[];

      await promisifyTransaction(transaction);

      return rows
        .map(
          (row): ListedEntityRecord => ({
            entityId: row.entityId,
            record: cloneStoredRecord(row),
          }),
        )
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async listChanges(entityName, entityId) {
      const database = await databasePromise;
      const transaction = database.transaction([CHANGE_STORE], "readonly");
      const store = transaction.objectStore(CHANGE_STORE);

      let rows: ChangeRow[];

      if (entityName && entityId) {
        rows = (await promisifyRequest(
          store.index(CHANGE_ENTITY_INDEX).getAll([entityName, entityId]),
        )) as ChangeRow[];
      } else if (entityName) {
        rows = (await promisifyRequest(store.getAll())) as ChangeRow[];
      } else {
        rows = (await promisifyRequest(store.getAll())) as ChangeRow[];
      }

      await promisifyTransaction(transaction);

      return rows
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map(cloneLocalChange);
    },

    async listPendingChanges() {
      const database = await databasePromise;
      const transaction = database.transaction([CHANGE_STORE], "readonly");
      const store = transaction.objectStore(CHANGE_STORE);
      const index = store.index(CHANGE_PENDING_INDEX);
      const entityPending = (await promisifyRequest(
        index.getAll([0, 0]),
      )) as ChangeRow[];
      const fullyPending = (await promisifyRequest(
        index.getAll([0, 1]),
      )) as ChangeRow[];
      const logPending = (await promisifyRequest(
        index.getAll([1, 0]),
      )) as ChangeRow[];

      await promisifyTransaction(transaction);

      const deduped = new Map<string, ChangeRow>();

      for (const change of [...entityPending, ...fullyPending, ...logPending]) {
        deduped.set(change.key, change);
      }

      return Array.from(deduped.values()).map(cloneLocalChange);
    },

    async readSyncMetadata() {
      const database = await databasePromise;
      return readSyncMetadataRow(database);
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const database = await databasePromise;
      const [rows, syncMetadata, updatedOrder] = await Promise.all([
        readEntityRows(database),
        readSyncMetadataRow(database),
        readUpdatedOrder(database),
      ]);
      const draft: TransactionDraft = {
        records: new Map(
          rows.map((row) => [`${row.entityName}:${row.entityId}`, cloneStoredRecordRow(row)]),
        ),
        syncMetadata,
        updatedOrder,
      };
      const writtenEntities = new Set<string>();
      const appendedChanges: ChangeRow[] = [];
      const entityProjectedChanges = new Set<string>();
      const logProjectedChanges = new Set<string>();
      let syncMetadataDirty = false;
      let updatedOrderDirty = false;

      const scopedTransaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          const row = draft.records.get(`${entityName}:${entityId}`);
          return row ? cloneStoredRecord(row) : null;
        },
        writeEntity(entityName, entityId, record) {
          const key = `${entityName}:${entityId}`;
          writtenEntities.add(key);
          draft.records.set(key, {
            entityName,
            entityId,
            ...cloneStoredRecord(record),
          });
        },
        appendChange(change) {
          appendedChanges.push({
            key: createChangeKey(change),
            ...cloneLocalChange(change),
          });
        },
        markChangeEntityProjected(changeId) {
          entityProjectedChanges.add(changeId);
        },
        markChangeLogProjected(changeId) {
          logProjectedChanges.add(changeId);
        },
        readSyncMetadata() {
          return cloneSyncMetadata(draft.syncMetadata);
        },
        writeSyncMetadata(metadata) {
          draft.syncMetadata = cloneSyncMetadata(metadata);
          syncMetadataDirty = true;
        },
        nextUpdatedOrder() {
          draft.updatedOrder += 1;
          updatedOrderDirty = true;
          return draft.updatedOrder;
        },
      };

      const result = await work(scopedTransaction);

      const transaction = database.transaction(
        [ENTITY_STORE, CHANGE_STORE, META_STORE],
        "readwrite",
      );
      const entityStore = transaction.objectStore(ENTITY_STORE);
      const changeStore = transaction.objectStore(CHANGE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      for (const key of writtenEntities) {
        const row = draft.records.get(key);

        if (row) {
          entityStore.put(row);
        }
      }

      for (const change of appendedChanges) {
        changeStore.put(normalizeChangeRow(change));
      }

      if (entityProjectedChanges.size > 0 || logProjectedChanges.size > 0) {
        const request = changeStore.getAll();
        const rows = (await promisifyRequest(request)) as ChangeRow[];

        for (const row of rows) {
          const nextEntityProjected =
            row.entityProjected || entityProjectedChanges.has(row.changeId);
          const nextLogProjected =
            row.logProjected || logProjectedChanges.has(row.changeId);

          if (
            nextEntityProjected !== row.entityProjected ||
            nextLogProjected !== row.logProjected
          ) {
            changeStore.put({
              ...row,
              entityProjected: nextEntityProjected,
              logProjected: nextLogProjected,
              pendingEntityProjected: nextEntityProjected ? 1 : 0,
              pendingLogProjected: nextLogProjected ? 1 : 0,
            });
          }
        }
      }

      if (updatedOrderDirty) {
        metaStore.put({
          key: UPDATED_ORDER_KEY,
          value: draft.updatedOrder,
        } satisfies MetaRow);
      }

      if (syncMetadataDirty) {
        metaStore.put({
          key: SYNC_METADATA_KEY,
          value: cloneSyncMetadata(draft.syncMetadata),
        } satisfies MetaRow);
      }

      await promisifyTransaction(transaction);
      return result;
    },
  };
}
