import type { LocalStorageTransaction } from "../types.js";
import { cloneSyncMetadata, cloneStoredRecord } from "./shared.js";
import {
  CHANGE_STORE,
  encodeChangeRow,
  encodeStoredRecordRow,
  ENTITY_STORE,
  hydrateStoredRecord,
  META_STORE,
  normalizeChangeRow,
  promisifyRequest,
  promisifyTransaction,
  SYNC_METADATA_KEY,
  type ChangeRow,
  type TransactionDraft,
  UPDATED_ORDER_KEY,
} from "./indexeddb-shared.js";

type TransactionWriteSet = {
  writtenEntities: Set<string>;
  removedEntities: Map<string, [entityName: string, entityId: string]>;
  appendedChanges: ChangeRow[];
  entityProjectedChanges: Set<string>;
  logProjectedChanges: Set<string>;
  syncMetadataDirty: boolean;
  updatedOrderDirty: boolean;
};

function createWriteSet(): TransactionWriteSet {
  return {
    writtenEntities: new Set<string>(),
    removedEntities: new Map<string, [entityName: string, entityId: string]>(),
    appendedChanges: [],
    entityProjectedChanges: new Set<string>(),
    logProjectedChanges: new Set<string>(),
    syncMetadataDirty: false,
    updatedOrderDirty: false,
  };
}

function createScopedTransaction(
  draft: TransactionDraft,
  writeSet: TransactionWriteSet,
): LocalStorageTransaction {
  return {
    readEntity(entityName, entityId) {
      const row = draft.records.get(`${entityName}:${entityId}`);
      return row ? cloneStoredRecord(hydrateStoredRecord(row)) : null;
    },
    removeEntity(entityName, entityId) {
      const key = `${entityName}:${entityId}`;
      writeSet.writtenEntities.delete(key);
      writeSet.removedEntities.set(key, [entityName, entityId]);
      draft.records.delete(key);
    },
    writeEntity(entityName, entityId, record) {
      const key = `${entityName}:${entityId}`;
      writeSet.removedEntities.delete(key);
      writeSet.writtenEntities.add(key);
      draft.records.set(
        key,
        encodeStoredRecordRow(entityName, entityId, record),
      );
    },
    appendChange(change) {
      writeSet.appendedChanges.push(encodeChangeRow(change));
    },
    markChangeEntityProjected(changeId) {
      writeSet.entityProjectedChanges.add(changeId);
    },
    markChangeLogProjected(changeId) {
      writeSet.logProjectedChanges.add(changeId);
    },
    readSyncMetadata() {
      return cloneSyncMetadata(draft.syncMetadata);
    },
    writeSyncMetadata(metadata) {
      draft.syncMetadata = cloneSyncMetadata(metadata);
      writeSet.syncMetadataDirty = true;
    },
    nextUpdatedOrder() {
      draft.updatedOrder += 1;
      writeSet.updatedOrderDirty = true;
      return draft.updatedOrder;
    },
  };
}

async function persistProjectedChangeFlags(
  changeStore: IDBObjectStore,
  writeSet: TransactionWriteSet,
): Promise<void> {
  if (
    writeSet.entityProjectedChanges.size === 0 &&
    writeSet.logProjectedChanges.size === 0
  ) {
    return;
  }

  const rows = (await promisifyRequest(changeStore.getAll())) as ChangeRow[];

  for (const row of rows) {
    const nextEntityProjected =
      row.entityProjected || writeSet.entityProjectedChanges.has(row.changeId);
    const nextLogProjected =
      row.logProjected || writeSet.logProjectedChanges.has(row.changeId);

    if (
      nextEntityProjected !== row.entityProjected ||
      nextLogProjected !== row.logProjected
    ) {
      changeStore.put(
        normalizeChangeRow({
          ...row,
          entityProjected: nextEntityProjected,
          logProjected: nextLogProjected,
        }),
      );
    }
  }
}

export async function runIndexedDbTransaction<T>(
  database: IDBDatabase,
  draft: TransactionDraft,
  work: (transaction: LocalStorageTransaction) => Promise<T> | T,
): Promise<T> {
  const writeSet = createWriteSet();
  const scopedTransaction = createScopedTransaction(draft, writeSet);
  const result = await work(scopedTransaction);

  const transaction = database.transaction(
    [ENTITY_STORE, CHANGE_STORE, META_STORE],
    "readwrite",
  );
  const entityStore = transaction.objectStore(ENTITY_STORE);
  const changeStore = transaction.objectStore(CHANGE_STORE);
  const metaStore = transaction.objectStore(META_STORE);

  for (const key of writeSet.writtenEntities) {
    const row = draft.records.get(key);

    if (row) {
      entityStore.put(row);
    }
  }

  for (const [entityName, entityId] of writeSet.removedEntities.values()) {
    entityStore.delete([entityName, entityId]);
  }

  for (const change of writeSet.appendedChanges) {
    changeStore.put(normalizeChangeRow(change));
  }

  await persistProjectedChangeFlags(changeStore, writeSet);

  if (writeSet.updatedOrderDirty) {
    metaStore.put({
      key: UPDATED_ORDER_KEY,
      value: draft.updatedOrder,
    });
  }

  if (writeSet.syncMetadataDirty) {
    metaStore.put({
      key: SYNC_METADATA_KEY,
      value: draft.syncMetadata,
    });
  }

  await promisifyTransaction(transaction);
  return result;
}
