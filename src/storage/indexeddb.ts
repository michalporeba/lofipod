import type {
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
} from "../types.js";

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
  updatedOrder: number;
};

const DATABASE_VERSION = 1;
const ENTITY_STORE = "entities";
const CHANGE_STORE = "changes";
const META_STORE = "meta";
const UPDATED_ORDER_KEY = "updatedOrder";

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

function cloneRecord(
  row: StoredEntityRecord<unknown>,
): StoredEntityRecord<unknown> {
  return {
    rootUri: row.rootUri,
    graph: [...row.graph],
    projection: row.projection,
    lastChangeId: row.lastChangeId,
    updatedOrder: row.updatedOrder,
  };
}

function cloneChange(change: LocalChange): LocalChange {
  return {
    ...change,
    assertions: [...change.assertions],
    retractions: [...change.retractions],
  };
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

  await promisifyTransaction(transaction);

  return {
    records: new Map(
      rows.map((row) => [`${row.entityName}:${row.entityId}`, row]),
    ),
    changes,
    updatedOrder: meta?.value ?? 0,
  };
}

async function writeDraftState(
  database: IDBDatabase,
  draft: DraftState,
): Promise<void> {
  const transaction = database.transaction(
    [ENTITY_STORE, CHANGE_STORE, META_STORE],
    "readwrite",
  );
  const entityStore = transaction.objectStore(ENTITY_STORE);
  const changeStore = transaction.objectStore(CHANGE_STORE);
  const metaStore = transaction.objectStore(META_STORE);

  entityStore.clear();
  changeStore.clear();

  for (const record of draft.records.values()) {
    entityStore.put(record);
  }

  for (const change of draft.changes) {
    changeStore.put(change);
  }

  metaStore.put({
    key: UPDATED_ORDER_KEY,
    value: draft.updatedOrder,
  } satisfies MetaRow);

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

      return record ? cloneRecord(record) : null;
    },

    async listEntities(entityName) {
      const database = await databasePromise;
      const draft = await readDraftState(database);

      return Array.from(draft.records.entries())
        .filter(([key]) => key.startsWith(`${entityName}:`))
        .map(
          ([key, row]): ListedEntityRecord => ({
            entityId: key.slice(entityName.length + 1),
            record: cloneRecord(row),
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
        .map(cloneChange);
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const database = await databasePromise;
      const draft = await readDraftState(database);

      const scopedTransaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          const row = draft.records.get(`${entityName}:${entityId}`);
          return row ? cloneRecord(row) : null;
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
        nextUpdatedOrder() {
          draft.updatedOrder += 1;
          return draft.updatedOrder;
        },
      };

      const result = await work(scopedTransaction);
      await writeDraftState(database, draft);
      return result;
    },
  };
}
