import type {
  ListedEntityRecord,
  LocalChange,
  StoredEntityRecord,
  SyncMetadata,
  Triple,
} from "../types.js";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneTriple([subject, predicate, object]: Triple): Triple {
  return [subject, predicate, object];
}

export function cloneTriples(triples: Triple[]): Triple[] {
  return triples.map(cloneTriple);
}

export function cloneStoredRecord(
  record: StoredEntityRecord<unknown>,
): StoredEntityRecord<unknown> {
  return {
    rootUri: record.rootUri,
    graph: cloneTriples(record.graph),
    projection: cloneValue(record.projection),
    lastChangeId: record.lastChangeId,
    updatedOrder: record.updatedOrder,
  };
}

export function cloneLocalChange(change: LocalChange): LocalChange {
  return {
    ...change,
    assertions: cloneTriples(change.assertions),
    retractions: cloneTriples(change.retractions),
    entityProjected: change.entityProjected,
    logProjected: change.logProjected,
  };
}

export function cloneSyncMetadata(metadata: SyncMetadata): SyncMetadata {
  return {
    observedRemoteChangeIds: [...metadata.observedRemoteChangeIds],
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
