import type {
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
} from "../types.js";

type MemoryStorageState = {
  records: Map<string, StoredEntityRecord<unknown>>;
  changes: LocalChange[];
  updatedOrder: number;
};

function cloneRecord(
  record: StoredEntityRecord<unknown>,
): StoredEntityRecord<unknown> {
  return {
    rootUri: record.rootUri,
    graph: [...record.graph],
    projection: record.projection,
    lastChangeId: record.lastChangeId,
    updatedOrder: record.updatedOrder,
  };
}

function cloneChange(change: LocalChange): LocalChange {
  return {
    ...change,
    assertions: [...change.assertions],
    retractions: [...change.retractions],
  };
}

function cloneState(state: MemoryStorageState): MemoryStorageState {
  return {
    records: new Map(
      Array.from(state.records.entries(), ([key, value]) => [
        key,
        cloneRecord(value),
      ]),
    ),
    changes: state.changes.map(cloneChange),
    updatedOrder: state.updatedOrder,
  };
}

function createListedEntityRecord(
  entityName: string,
  key: string,
  record: StoredEntityRecord<unknown>,
): ListedEntityRecord {
  return {
    entityId: key.slice(entityName.length + 1),
    record: cloneRecord(record),
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

      return record ? cloneRecord(record) : null;
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
        .map(cloneChange);
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
          draft.records.set(`${entityName}:${entityId}`, cloneRecord(record));
        },
        appendChange(change) {
          draft.changes.push(cloneChange(change));
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
