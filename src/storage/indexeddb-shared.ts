import { normalizeChangeTimestamp } from "../change-log.js";
import type {
  ListedEntityRecord,
  LocalChange,
  StoredEntityRecord,
  SyncMetadata,
} from "../types.js";
import { decodeStoredTriples, encodeStoredTriples } from "../rdf.js";
import {
  cloneLocalChange,
  cloneStoredRecord,
  cloneSyncMetadata,
  createDefaultSyncMetadata,
} from "./shared.js";

export type StoredRecordRow = Omit<StoredEntityRecord<unknown>, "graph"> & {
  graph: unknown;
  entityName: string;
  entityId: string;
};

export type MetaRow = {
  key: string;
  value: number | SyncMetadata;
};

export type ChangeRow = Omit<LocalChange, "assertions" | "retractions"> & {
  assertions: unknown;
  retractions: unknown;
  key: string;
  pendingEntityProjected?: 0 | 1;
  pendingLogProjected?: 0 | 1;
};

export type TransactionDraft = {
  records: Map<string, StoredRecordRow>;
  syncMetadata: SyncMetadata;
  updatedOrder: number;
};

export const DATABASE_VERSION = 3;
export const ENTITY_STORE = "entities";
export const CHANGE_STORE = "changes";
export const META_STORE = "meta";
export const ENTITY_NAME_INDEX = "byEntityName";
export const CHANGE_ENTITY_INDEX = "byEntity";
export const CHANGE_PENDING_INDEX = "byPending";
export const UPDATED_ORDER_KEY = "updatedOrder";
export const SYNC_METADATA_KEY = "syncMetadata";

export function createChangeKey(change: LocalChange): string {
  return `${change.entityName}:${change.entityId}:${change.changeId}`;
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function promisifyTransaction(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function ensureEntityIndexes(store: IDBObjectStore): void {
  if (!store.indexNames.contains(ENTITY_NAME_INDEX)) {
    store.createIndex(ENTITY_NAME_INDEX, "entityName");
  }
}

export function ensureChangeIndexes(store: IDBObjectStore): void {
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

export function normalizeChangeRow(row: ChangeRow): ChangeRow {
  return {
    ...row,
    pendingEntityProjected: row.entityProjected ? 1 : 0,
    pendingLogProjected: row.logProjected ? 1 : 0,
  };
}

export function hydrateStoredRecord(
  row: StoredRecordRow,
): StoredEntityRecord<unknown> {
  return {
    rootUri: row.rootUri,
    graph: decodeStoredTriples(
      row.graph as Parameters<typeof decodeStoredTriples>[0],
    ),
    projection: row.projection,
    lastChangeId: row.lastChangeId,
    updatedOrder: row.updatedOrder,
  };
}

export function hydrateListedEntityRecord(
  row: StoredRecordRow,
): ListedEntityRecord {
  return {
    entityId: row.entityId,
    record: cloneStoredRecord(hydrateStoredRecord(row)),
  };
}

export function hydrateChange(row: ChangeRow): LocalChange {
  return {
    entityName: row.entityName,
    entityId: row.entityId,
    changeId: row.changeId,
    parentChangeId: row.parentChangeId,
    timestamp: normalizeChangeTimestamp(row.timestamp),
    assertions: decodeStoredTriples(
      row.assertions as Parameters<typeof decodeStoredTriples>[0],
    ),
    retractions: decodeStoredTriples(
      row.retractions as Parameters<typeof decodeStoredTriples>[0],
    ),
    entityProjected: row.entityProjected,
    logProjected: row.logProjected,
  };
}

export function cloneStoredRecordRow(row: StoredRecordRow): StoredRecordRow {
  return {
    entityName: row.entityName,
    entityId: row.entityId,
    ...cloneStoredRecord(hydrateStoredRecord(row)),
  };
}

export function encodeStoredRecordRow(
  entityName: string,
  entityId: string,
  record: StoredEntityRecord<unknown>,
): StoredRecordRow {
  return {
    entityName,
    entityId,
    ...cloneStoredRecord(record),
    graph: encodeStoredTriples(record.graph),
  };
}

export function encodeChangeRow(change: LocalChange): ChangeRow {
  return {
    key: createChangeKey(change),
    ...cloneLocalChange(change),
    assertions: encodeStoredTriples(change.assertions),
    retractions: encodeStoredTriples(change.retractions),
  };
}

export async function readEntityRows(
  database: IDBDatabase,
): Promise<StoredRecordRow[]> {
  const transaction = database.transaction([ENTITY_STORE], "readonly");
  const store = transaction.objectStore(ENTITY_STORE);
  const rows = (await promisifyRequest(store.getAll())) as StoredRecordRow[];

  await promisifyTransaction(transaction);
  return rows;
}

export async function readUpdatedOrder(database: IDBDatabase): Promise<number> {
  const transaction = database.transaction([META_STORE], "readonly");
  const metaStore = transaction.objectStore(META_STORE);
  const row = (await promisifyRequest(metaStore.get(UPDATED_ORDER_KEY))) as
    | MetaRow
    | undefined;

  await promisifyTransaction(transaction);
  return typeof row?.value === "number" ? row.value : 0;
}

export async function readSyncMetadataRow(
  database: IDBDatabase,
): Promise<SyncMetadata> {
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

export function openDatabase(databaseName: string): Promise<IDBDatabase> {
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

      if (
        event.oldVersion < 3 &&
        database.objectStoreNames.contains(CHANGE_STORE)
      ) {
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
