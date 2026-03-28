import type {
  ListedEntityRecord,
  LocalChange,
  StoredEntityRecord,
} from "../types.js";

export function cloneStoredRecord(
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

export function cloneLocalChange(change: LocalChange): LocalChange {
  return {
    ...change,
    assertions: [...change.assertions],
    retractions: [...change.retractions],
  };
}

export function createListedEntityRecord(
  entityName: string,
  key: string,
  record: StoredEntityRecord<unknown>,
): ListedEntityRecord {
  return {
    entityId: key.slice(entityName.length + 1),
    record: cloneStoredRecord(record),
  };
}
