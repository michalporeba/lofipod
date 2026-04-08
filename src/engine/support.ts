import {
  createProjectionHelpers,
  fallbackRootUri,
  projectionsMatch,
  projectStoredRecord,
} from "../graph.js";
import { isNamedNodeTerm, uri } from "../rdf.js";
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
  const projected = projectStoredRecord(definition, record);

  if (!projectionsMatch(record.projection, projected)) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.name, entityId);

      if (!latest) {
        return;
      }

      transaction.writeEntity(definition.name, entityId, {
        ...latest,
        projection: projected,
      });
    });
  }

  return projected;
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
