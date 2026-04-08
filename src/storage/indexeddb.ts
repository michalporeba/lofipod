import type { LocalStorageAdapter, LocalStorageTransaction } from "../types.js";
import { cloneLocalChange, cloneStoredRecord } from "./shared.js";
import {
  CHANGE_ENTITY_INDEX,
  CHANGE_PENDING_INDEX,
  CHANGE_STORE,
  ENTITY_NAME_INDEX,
  ENTITY_STORE,
  hydrateChange,
  hydrateListedEntityRecord,
  hydrateStoredRecord,
  openDatabase,
  promisifyRequest,
  promisifyTransaction,
  readEntityRows,
  readSyncMetadataRow,
  readUpdatedOrder,
  type ChangeRow,
  type TransactionDraft,
} from "./indexeddb-shared.js";
import { runIndexedDbTransaction } from "./indexeddb-transaction.js";

type IndexedDbStorageOptions = {
  databaseName: string;
};

async function readChangeRows(
  database: IDBDatabase,
  entityName?: string,
  entityId?: string,
): Promise<ChangeRow[]> {
  const transaction = database.transaction([CHANGE_STORE], "readonly");
  const store = transaction.objectStore(CHANGE_STORE);

  let rows: ChangeRow[];

  if (entityName && entityId) {
    rows = (await promisifyRequest(
      store.index(CHANGE_ENTITY_INDEX).getAll([entityName, entityId]),
    )) as ChangeRow[];
  } else {
    rows = (await promisifyRequest(store.getAll())) as ChangeRow[];
  }

  await promisifyTransaction(transaction);
  return rows;
}

async function readPendingChangeRows(
  database: IDBDatabase,
): Promise<ChangeRow[]> {
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

  return Array.from(deduped.values());
}

function createDraft(
  rows: Awaited<ReturnType<typeof readEntityRows>>,
  syncMetadata: Awaited<ReturnType<typeof readSyncMetadataRow>>,
  updatedOrder: number,
): TransactionDraft {
  return {
    records: new Map(
      rows.map((row) => [`${row.entityName}:${row.entityId}`, row]),
    ),
    syncMetadata,
    updatedOrder,
  };
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
      )) as Parameters<typeof hydrateStoredRecord>[0] | undefined;

      await promisifyTransaction(transaction);
      return row ? cloneStoredRecord(hydrateStoredRecord(row)) : null;
    },

    async listEntities(entityName) {
      const database = await databasePromise;
      const transaction = database.transaction([ENTITY_STORE], "readonly");
      const store = transaction.objectStore(ENTITY_STORE);
      const index = store.index(ENTITY_NAME_INDEX);
      const rows = (await promisifyRequest(
        index.getAll(entityName),
      )) as Parameters<typeof hydrateListedEntityRecord>[0][];

      await promisifyTransaction(transaction);

      return rows
        .map(hydrateListedEntityRecord)
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async listChanges(entityName, entityId) {
      const database = await databasePromise;
      const rows = await readChangeRows(database, entityName, entityId);

      return rows
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map((change) => cloneLocalChange(hydrateChange(change)));
    },

    async listPendingChanges() {
      const database = await databasePromise;
      const rows = await readPendingChangeRows(database);

      return rows.map((change) => cloneLocalChange(hydrateChange(change)));
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

      return runIndexedDbTransaction<T>(
        database,
        createDraft(rows, syncMetadata, updatedOrder),
        work,
      );
    },
  };
}
