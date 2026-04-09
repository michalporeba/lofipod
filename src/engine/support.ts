import {
  createToRdfHelpers,
  createProjectionHelpers,
  diffTriples,
  fallbackRootUri,
  projectionsMatch,
  projectStoredRecord,
} from "../graph.js";
import {
  isNamedNodeTerm,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
  uri,
} from "../rdf.js";
import { normalizeLogBasePath } from "../sync.js";
import { rdf } from "../vocabulary.js";
import type {
  EngineConfig,
  EntityDefinition,
  StoredEntityRecord,
  Triple,
} from "../types.js";

export type EngineStorage = NonNullable<EngineConfig["storage"]>;

export function createChangeId(): string {
  return globalThis.crypto.randomUUID();
}

export function entityPath(
  definition: EntityDefinition<unknown>,
  entityId: string,
): string {
  return `${definition.pod.basePath}${entityId}.ttl`;
}

export function requireEntityDefinition(
  entities: Map<string, EntityDefinition<unknown>>,
  entityName: string,
): EntityDefinition<unknown> {
  const entity = entities.get(entityName);

  if (!entity) {
    throw new Error(`Unknown entity type: ${entityName}`);
  }

  return entity;
}

export function requireLogBasePath(config: EngineConfig): string {
  const logBasePath = config.pod?.logBasePath;

  if (!logBasePath) {
    throw new Error("Pod logBasePath is required for remote log projection.");
  }

  return normalizeLogBasePath(logBasePath);
}

export async function readObservedRemoteChangeIds(
  storage: EngineStorage,
): Promise<Set<string>> {
  const metadata = await storage.readSyncMetadata();
  return new Set(metadata.observedRemoteChangeIds);
}

export async function rememberObservedRemoteChangeIds(
  storage: EngineStorage,
  changeIds: Iterable<string>,
): Promise<void> {
  await storage.transact((transaction) => {
    const metadata = transaction.readSyncMetadata();
    const observed = new Set(metadata.observedRemoteChangeIds);

    for (const changeId of changeIds) {
      observed.add(changeId);
    }

    transaction.writeSyncMetadata({
      observedRemoteChangeIds: Array.from(observed).sort(),
    });
  });
}

export function inferRootUri(
  definition: EntityDefinition<unknown>,
  entityId: string,
  triples: Triple[],
  fallback?: string,
): string {
  const typedSubject = triples.find(
    ([subject, predicate, object]) =>
      predicate.value === rdf.type.value &&
      isNamedNodeTerm(subject) &&
      isNamedNodeTerm(object) &&
      object.value === definition.rdfType.value,
  )?.[0];

  if (isNamedNodeTerm(typedSubject)) {
    return typedSubject.value;
  }

  const firstNamedSubject = triples.find(([subject]) =>
    isNamedNodeTerm(subject),
  )?.[0];

  if (isNamedNodeTerm(firstNamedSubject)) {
    return firstNamedSubject.value;
  }

  return fallback ?? fallbackRootUri(definition.name, entityId);
}

export async function repairStoredProjection<T>(
  storage: EngineStorage,
  definition: EntityDefinition<T>,
  entityId: string,
  record: StoredEntityRecord<unknown>,
): Promise<T> {
  const repair = createStoredEntityRepair(definition, record);

  if (repair.assertions.length > 0 || repair.retractions.length > 0) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.name, entityId);

      if (!latest) {
        return;
      }

      const latestRepair = createStoredEntityRepair(definition, latest);

      if (
        latestRepair.assertions.length === 0 &&
        latestRepair.retractions.length === 0
      ) {
        if (!projectionsMatch(latest.projection, latestRepair.projection)) {
          transaction.writeEntity(definition.name, entityId, {
            ...latest,
            projection: latestRepair.projection,
          });
        }

        return;
      }

      const changeId = createChangeId();

      transaction.writeEntity(definition.name, entityId, {
        ...latest,
        rootUri: latestRepair.rootUri,
        graph: latestRepair.graph,
        projection: latestRepair.projection,
        lastChangeId: changeId,
      });
      transaction.appendChange({
        entityName: definition.name,
        entityId,
        changeId,
        parentChangeId: latest.lastChangeId,
        assertions: latestRepair.assertions,
        retractions: latestRepair.retractions,
        entityProjected: false,
        logProjected: false,
      });
    });

    return repair.projection;
  }

  if (!projectionsMatch(record.projection, repair.projection)) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.name, entityId);

      if (!latest) {
        return;
      }

      const latestRepair = createStoredEntityRepair(definition, latest);

      if (
        latestRepair.assertions.length > 0 ||
        latestRepair.retractions.length > 0
      ) {
        const changeId = createChangeId();

        transaction.writeEntity(definition.name, entityId, {
          ...latest,
          rootUri: latestRepair.rootUri,
          graph: latestRepair.graph,
          projection: latestRepair.projection,
          lastChangeId: changeId,
        });
        transaction.appendChange({
          entityName: definition.name,
          entityId,
          changeId,
          parentChangeId: latest.lastChangeId,
          assertions: latestRepair.assertions,
          retractions: latestRepair.retractions,
          entityProjected: false,
          logProjected: false,
        });
        return;
      }

      transaction.writeEntity(definition.name, entityId, {
        ...latest,
        rootUri: latestRepair.rootUri,
        projection: latestRepair.projection,
      });
    });
  }

  return repair.projection;
}

export function createRemoteProjectionHelpers(rootUri: string) {
  return createProjectionHelpers(rootUri);
}

export function fallbackEntityRootUri(
  definition: EntityDefinition<unknown>,
  entityId: string,
): string {
  return fallbackRootUri(definition.name, entityId);
}

export function rootUriTerm(value: string) {
  return uri(value);
}

function createStoredEntityRepair<T>(
  definition: EntityDefinition<T>,
  record: StoredEntityRecord<unknown>,
): {
  rootUri: string;
  projection: T;
  graph: Triple[];
  assertions: Triple[];
  retractions: Triple[];
} {
  const projected = projectStoredRecord(definition, record);
  const entityId = definition.id(projected);
  const rootUri =
    definition.uri?.(projected)?.value ??
    fallbackEntityRootUri(definition, entityId);
  const nextGraph = definition.toRdf(projected, createToRdfHelpers(rootUri));
  const currentInternalGraph = publicTriplesToRdfTriples(record.graph, {
    rdfType: definition.rdfType,
  });
  const nextInternalGraph = publicTriplesToRdfTriples(nextGraph, {
    rdfType: definition.rdfType,
  });
  const { assertions, retractions } = diffTriples(
    currentInternalGraph,
    nextInternalGraph,
  );
  const graph = rdfTriplesToPublicTriples(nextInternalGraph);
  const projection = definition.project(
    graph,
    createProjectionHelpers(rootUri),
  );

  return {
    rootUri,
    projection,
    graph,
    assertions: rdfTriplesToPublicTriples(assertions),
    retractions: rdfTriplesToPublicTriples(retractions),
  };
}
