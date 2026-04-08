import {
  createStoredRecord,
  createToRdfHelpers,
  diffTriples,
} from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import type { EntityDefinition } from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createChangeId,
  fallbackEntityRootUri,
  repairStoredProjection,
  rootUriTerm,
} from "./support.js";

export async function saveEntity<T>(
  storage: EngineStorage,
  definition: EntityDefinition<T>,
  entity: T,
): Promise<T> {
  const entityId = definition.id(entity);
  const rootUri =
    definition.uri?.(entity) ??
    rootUriTerm(fallbackEntityRootUri(definition, entityId));
  const previousRecord = await storage.readEntity(definition.name, entityId);
  const graph = definition.toRdf(entity, createToRdfHelpers(rootUri.value));
  const internalGraph = publicTriplesToRdfTriples(graph, {
    rdfType: definition.rdfType,
  });
  const previousGraph = previousRecord
    ? publicTriplesToRdfTriples(previousRecord.graph, {
        rdfType: definition.rdfType,
      })
    : [];
  const { assertions, retractions } = diffTriples(previousGraph, internalGraph);

  if (assertions.length === 0 && retractions.length === 0) {
    return (previousRecord?.projection as T) ?? entity;
  }

  const storedGraph = rdfTriplesToPublicTriples(internalGraph);
  const storedAssertions = rdfTriplesToPublicTriples(assertions);
  const storedRetractions = rdfTriplesToPublicTriples(retractions);
  const changeId = createChangeId();

  const storedRecord = await storage.transact((transaction) => {
    const updatedOrder = transaction.nextUpdatedOrder();
    const nextRecord = createStoredRecord(
      definition,
      entity,
      storedGraph,
      changeId,
      updatedOrder,
    );

    transaction.writeEntity(definition.name, entityId, nextRecord);
    transaction.appendChange({
      entityName: definition.name,
      entityId,
      changeId,
      parentChangeId: previousRecord?.lastChangeId ?? null,
      assertions: storedAssertions,
      retractions: storedRetractions,
      entityProjected: false,
      logProjected: false,
    });

    return nextRecord;
  });

  return storedRecord.projection as T;
}

export async function deleteEntity(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  entityId: string,
): Promise<void> {
  const previousRecord = await storage.readEntity(definition.name, entityId);

  if (!previousRecord) {
    return;
  }

  await storage.transact((transaction) => {
    transaction.removeEntity(definition.name, entityId);
    transaction.appendChange({
      entityName: definition.name,
      entityId,
      changeId: createChangeId(),
      parentChangeId: previousRecord.lastChangeId,
      assertions: [],
      retractions: previousRecord.graph,
      entityProjected: false,
      logProjected: false,
    });
  });
}

export async function getEntity<T>(
  storage: EngineStorage,
  definition: EntityDefinition<T>,
  entityId: string,
): Promise<T | null> {
  const record = await storage.readEntity(definition.name, entityId);

  if (!record) {
    return null;
  }

  return repairStoredProjection(storage, definition, entityId, record);
}

export async function listEntities<T>(
  storage: EngineStorage,
  definition: EntityDefinition<T>,
  options?: { limit?: number },
): Promise<T[]> {
  const records = await storage.listEntities(definition.name);
  const limited =
    typeof options?.limit === "number"
      ? records.slice(0, options.limit)
      : records;

  return Promise.all(
    limited.map(({ entityId, record }) =>
      repairStoredProjection(storage, definition, entityId, record),
    ),
  );
}
