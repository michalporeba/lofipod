import type {
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
} from "../types.js";
import {
  cloneLocalChange,
  cloneStoredRecord,
  createListedEntityRecord,
} from "./shared.js";

type MemoryStorageState = {
  records: Map<string, StoredEntityRecord<unknown>>;
  changes: LocalChange[];
  updatedOrder: number;
};

function cloneState(state: MemoryStorageState): MemoryStorageState {
  return {
    records: new Map(
      Array.from(state.records.entries(), ([key, value]) => [
        key,
        cloneStoredRecord(value),
      ]),
    ),
    changes: state.changes.map(cloneLocalChange),
    updatedOrder: state.updatedOrder,
  };
}

export function createMemoryStorage(): LocalStorageAdapter {
  const state: MemoryStorageState = {
    records: new Map<string, StoredEntityRecord<unknown>>(),
    changes: [],
    updatedOrder: 0,
  };

  return {
    async readEntity(entityName, entityId) {
      const record = state.records.get(`${entityName}:${entityId}`);

      return record ? cloneStoredRecord(record) : null;
    },

    async listEntities(entityName) {
      return Array.from(state.records.entries())
        .filter(([key]) => key.startsWith(`${entityName}:`))
        .map(([key, record]) =>
          createListedEntityRecord(entityName, key, record),
        )
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async listChanges(entityName, entityId) {
      return state.changes
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map(cloneLocalChange);
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const draft = cloneState(state);

      const transaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          return draft.records.get(`${entityName}:${entityId}`) ?? null;
        },
        writeEntity(entityName, entityId, record) {
          draft.records.set(
            `${entityName}:${entityId}`,
            cloneStoredRecord(record),
          );
        },
        appendChange(change) {
          draft.changes.push(cloneLocalChange(change));
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
        nextUpdatedOrder() {
          draft.updatedOrder += 1;
          return draft.updatedOrder;
        },
      };

      const result = await work(transaction);

      state.records = draft.records;
      state.changes = draft.changes;
      state.updatedOrder = draft.updatedOrder;

      return result;
    },
  };
}
