import { createChangeTimestamp } from "../change-log.js";
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
  MigrationOutcome,
  StoredEntityRecord,
  Triple,
} from "../types.js";

export type EngineStorage = NonNullable<EngineConfig["storage"]>;
const MIGRATION_FAILURE_BRAND = "lofipod.migrationFailure";
type MigrationFailurePhase =
  | "local-reprojection"
  | "remote-log-replay"
  | "canonical-reconciliation";
type MigrationFailureError = Error & {
  [MIGRATION_FAILURE_BRAND]: true;
  migration: {
    entityName: string;
    entityId: string;
    phase: MigrationFailurePhase;
  };
};

export function createChangeId(): string {
  return globalThis.crypto.randomUUID();
}

export function createTimestamp(): string {
  return createChangeTimestamp();
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
      ...metadata,
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

  return fallback ?? fallbackRootUri(definition.kind, entityId);
}

export async function repairStoredProjection<T>(
  storage: EngineStorage,
  definition: EntityDefinition<T>,
  entityId: string,
  record: StoredEntityRecord<unknown>,
): Promise<T> {
  let repair: ReturnType<typeof createStoredEntityRepair<T>>;
  try {
    repair = createStoredEntityRepair(definition, record, entityId);
  } catch (error) {
    await rememberMigrationOutcome(storage, {
      scope: "local",
      entityName: definition.kind,
      entityId,
      phase: "local-reprojection",
      action: "failed",
      reason: describeMigrationFailureCause(error),
      at: createTimestamp(),
    });
    throw createMigrationFailureError({
      entityName: definition.kind,
      entityId,
      phase: "local-reprojection",
      cause: error,
    });
  }

  if (repair.assertions.length > 0 || repair.retractions.length > 0) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.kind, entityId);

      if (!latest) {
        return;
      }

      let latestRepair: ReturnType<typeof createStoredEntityRepair<T>>;
      try {
        latestRepair = createStoredEntityRepair(definition, latest, entityId);
      } catch (error) {
        throw createMigrationFailureError({
          entityName: definition.kind,
          entityId,
          phase: "local-reprojection",
          cause: error,
        });
      }

      if (
        latestRepair.assertions.length === 0 &&
        latestRepair.retractions.length === 0
      ) {
        if (!projectionsMatch(latest.projection, latestRepair.projection)) {
          transaction.writeEntity(definition.kind, entityId, {
            ...latest,
            projection: latestRepair.projection,
          });
        }

        return;
      }

      const changeId = createChangeId();

      transaction.writeEntity(definition.kind, entityId, {
        ...latest,
        rootUri: latestRepair.rootUri,
        graph: latestRepair.graph,
        projection: latestRepair.projection,
        lastChangeId: changeId,
      });
      transaction.appendChange({
        entityName: definition.kind,
        entityId,
        changeId,
        parentChangeId: latest.lastChangeId,
        timestamp: createTimestamp(),
        assertions: latestRepair.assertions,
        retractions: latestRepair.retractions,
        entityProjected: false,
        logProjected: false,
      });
    });

    await rememberMigrationOutcome(storage, {
      scope: "local",
      entityName: definition.kind,
      entityId,
      phase: "local-reprojection",
      action: "repaired",
      reason: null,
      at: createTimestamp(),
    });
    return repair.projection;
  }

  if (!projectionsMatch(record.projection, repair.projection)) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.kind, entityId);

      if (!latest) {
        return;
      }

      let latestRepair: ReturnType<typeof createStoredEntityRepair<T>>;
      try {
        latestRepair = createStoredEntityRepair(definition, latest, entityId);
      } catch (error) {
        throw createMigrationFailureError({
          entityName: definition.kind,
          entityId,
          phase: "local-reprojection",
          cause: error,
        });
      }

      if (
        latestRepair.assertions.length > 0 ||
        latestRepair.retractions.length > 0
      ) {
        const changeId = createChangeId();

        transaction.writeEntity(definition.kind, entityId, {
          ...latest,
          rootUri: latestRepair.rootUri,
          graph: latestRepair.graph,
          projection: latestRepair.projection,
          lastChangeId: changeId,
        });
        transaction.appendChange({
          entityName: definition.kind,
          entityId,
          changeId,
          parentChangeId: latest.lastChangeId,
          timestamp: createTimestamp(),
          assertions: latestRepair.assertions,
          retractions: latestRepair.retractions,
          entityProjected: false,
          logProjected: false,
        });
        return;
      }

      transaction.writeEntity(definition.kind, entityId, {
        ...latest,
        rootUri: latestRepair.rootUri,
        projection: latestRepair.projection,
      });
    });
  }

  await rememberMigrationOutcome(storage, {
    scope: "local",
    entityName: definition.kind,
    entityId,
    phase: "local-reprojection",
    action: "unchanged",
    reason: null,
    at: createTimestamp(),
  });

  return repair.projection;
}

export function createRemoteProjectionHelpers(rootUri: string) {
  return createProjectionHelpers(rootUri);
}

export function fallbackEntityRootUri(
  definition: EntityDefinition<unknown>,
  entityId: string,
): string {
  return fallbackRootUri(definition.kind, entityId);
}

export function rootUriTerm(value: string) {
  return uri(value);
}

export function createMigrationFailureError(input: {
  entityName: string;
  entityId: string;
  phase: MigrationFailurePhase;
  cause: unknown;
}): Error {
  if (isMigrationFailureError(input.cause)) {
    return input.cause;
  }

  const reason = describeMigrationFailureCause(input.cause);
  const message = `Unsupported or incomplete migration for ${input.entityName}/${input.entityId}: ${reason} (phase=${input.phase})`;
  const error = new Error(message) as MigrationFailureError;
  error[MIGRATION_FAILURE_BRAND] = true;
  error.migration = {
    entityName: input.entityName,
    entityId: input.entityId,
    phase: input.phase,
  };
  Object.defineProperty(error, "cause", {
    value: input.cause,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  if (input.cause instanceof Error && input.cause.stack) {
    error.stack = `${error.name}: ${message}\nCaused by: ${input.cause.stack}`;
  }

  return error;
}

export async function rememberMigrationOutcome(
  storage: EngineStorage,
  outcome: MigrationOutcome,
): Promise<void> {
  await storage.transact((transaction) => {
    const metadata = transaction.readSyncMetadata();
    const previous = metadata.migration ?? {
      lastLocalOutcome: null,
      lastCanonicalRemoteOutcome: null,
    };

    transaction.writeSyncMetadata({
      ...metadata,
      migration: {
        ...previous,
        ...(outcome.scope === "local"
          ? { lastLocalOutcome: outcome }
          : { lastCanonicalRemoteOutcome: outcome }),
      },
    });
  });
}

function createStoredEntityRepair<T>(
  definition: EntityDefinition<T>,
  record: StoredEntityRecord<unknown>,
  expectedEntityId: string,
): {
  rootUri: string;
  projection: T;
  graph: Triple[];
  assertions: Triple[];
  retractions: Triple[];
} {
  const projected = projectStoredRecord(definition, record);
  const entityId = definition.id(projected);

  if (entityId !== expectedEntityId) {
    throw new Error(
      `Stored projection entity ID mismatch: expected ${expectedEntityId}, got ${entityId}.`,
    );
  }

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

function isMigrationFailureError(
  value: unknown,
): value is MigrationFailureError {
  return (
    value instanceof Error &&
    (value as Partial<MigrationFailureError>)[MIGRATION_FAILURE_BRAND] === true
  );
}

function describeMigrationFailureCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
