import { createMemoryStorage } from "./storage/memory.js";
import {
  applyTripleDelta,
  createStoredRecord,
  createProjectionHelpers,
  createToRdfHelpers,
  diffTriples,
  fallbackRootUri,
  graphsMatch,
  projectionsMatch,
  projectStoredRecord,
} from "./graph.js";
import {
  isNamedNodeTerm,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
  uri,
} from "./rdf.js";
import {
  createEntityPatchRequest,
  createLogAppendRequest,
  hasPendingSync,
  normalizeLogBasePath,
  readSyncState,
} from "./sync.js";
import { rdf } from "./vocabulary.js";
import type {
  BootstrapResult,
  Engine,
  EngineConfig,
  EntityDefinition,
  StoredEntityRecord,
  SyncState,
  Triple,
} from "./types.js";

function createChangeId(): string {
  return globalThis.crypto.randomUUID();
}

function entityPath(
  definition: EntityDefinition<unknown>,
  entityId: string,
): string {
  return `${definition.pod.basePath}${entityId}.ttl`;
}

function inferRootUri(
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

async function repairStoredProjection<T>(
  storage: EngineConfig["storage"] extends infer _
    ? NonNullable<EngineConfig["storage"]>
    : never,
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

export function createEngine(config: EngineConfig): Engine {
  const entities = new Map(
    config.entities.map((entity) => [entity.name, entity]),
  );
  const storage = config.storage ?? createMemoryStorage();

  const requireEntity = (entityName: string): EntityDefinition<unknown> => {
    const entity = entities.get(entityName);

    if (!entity) {
      throw new Error(`Unknown entity type: ${entityName}`);
    }

    return entity;
  };

  const requireLogBasePath = (): string => {
    const logBasePath = config.pod?.logBasePath;

    if (!logBasePath) {
      throw new Error("Pod logBasePath is required for remote log projection.");
    }

    return normalizeLogBasePath(logBasePath);
  };

  const readObservedRemoteChangeIds = async (): Promise<Set<string>> => {
    const metadata = await storage.readSyncMetadata();
    return new Set(metadata.observedRemoteChangeIds);
  };

  const rememberObservedRemoteChangeIds = async (
    changeIds: Iterable<string>,
  ): Promise<void> => {
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
  };

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const entityId = definition.id(entity);
      const rootUri =
        definition.uri?.(entity) ??
        uri(fallbackRootUri(definition.name, entityId));
      const previousRecord = await storage.readEntity(
        definition.name,
        entityId,
      );
      const graph = definition.toRdf(entity, createToRdfHelpers(rootUri.value));
      const internalGraph = publicTriplesToRdfTriples(graph, {
        rdfType: definition.rdfType,
      });
      const previousGraph = previousRecord
        ? publicTriplesToRdfTriples(previousRecord.graph, {
            rdfType: definition.rdfType,
          })
        : [];
      const { assertions, retractions } = diffTriples(
        previousGraph,
        internalGraph,
      );

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
    },

    async delete(entityName: string, id: string): Promise<void> {
      requireEntity(entityName);
      const previousRecord = await storage.readEntity(entityName, id);

      if (!previousRecord) {
        return;
      }

      await storage.transact((transaction) => {
        transaction.removeEntity(entityName, id);
        transaction.appendChange({
          entityName,
          entityId: id,
          changeId: createChangeId(),
          parentChangeId: previousRecord.lastChangeId,
          assertions: [],
          retractions: previousRecord.graph,
          entityProjected: false,
          logProjected: false,
        });
      });
    },

    async get<T>(entityName: string, id: string): Promise<T | null> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const record = await storage.readEntity(definition.name, id);

      if (!record) {
        return null;
      }

      return repairStoredProjection(storage, definition, id, record);
    },

    async list<T>(
      entityName: string,
      options?: { limit?: number },
    ): Promise<T[]> {
      requireEntity(entityName);

      const records = await storage.listEntities(entityName);
      const limited =
        typeof options?.limit === "number"
          ? records.slice(0, options.limit)
          : records;

      const projected = await Promise.all(
        limited.map(async ({ entityId, record }) => {
          return repairStoredProjection(
            storage,
            requireEntity(entityName) as EntityDefinition<T>,
            entityId,
            record,
          );
        }),
      );

      return projected;
    },

    sync: {
      async state(): Promise<SyncState> {
        return readSyncState(storage, config.sync);
      },

      async now(): Promise<void> {
        if (!config.sync) {
          return;
        }

        const pendingChanges = storage.listPendingChanges
          ? await storage.listPendingChanges()
          : (await storage.listChanges()).filter(hasPendingSync);
        const deletedEntities = new Set(
          pendingChanges
            .filter(
              (change) =>
                change.assertions.length === 0 && change.retractions.length > 0,
            )
            .map((change) => `${change.entityName}:${change.entityId}`),
        );

        for (const change of pendingChanges) {
          const definition = requireEntity(change.entityName);
          const record = await storage.readEntity(
            change.entityName,
            change.entityId,
          );
          const isDeletion =
            change.assertions.length === 0 && change.retractions.length > 0;

          if (!record && !isDeletion) {
            if (
              deletedEntities.has(`${change.entityName}:${change.entityId}`)
            ) {
              await storage.transact((transaction) => {
                transaction.markChangeEntityProjected(change.changeId);
                transaction.markChangeLogProjected(change.changeId);
              });
            }

            continue;
          }

          if (!change.entityProjected) {
            if (isDeletion) {
              await config.sync.adapter.deleteEntityResource?.({
                entityName: change.entityName,
                entityId: change.entityId,
                path: entityPath(definition, change.entityId),
              });
            } else if (record) {
              await config.sync.adapter.applyEntityPatch(
                createEntityPatchRequest(definition, record, change),
              );
            }

            await storage.transact((transaction) => {
              transaction.markChangeEntityProjected(change.changeId);
            });
          }

          if (!change.logProjected) {
            const rootUri = inferRootUri(
              definition,
              change.entityId,
              change.assertions.length > 0
                ? change.assertions
                : change.retractions,
              record?.rootUri,
            );

            await config.sync.adapter.appendLogEntry(
              createLogAppendRequest(
                change,
                {
                  rootUri,
                  graph: [],
                  projection: null,
                  lastChangeId: null,
                  updatedOrder: 0,
                },
                requireLogBasePath(),
              ),
            );

            await storage.transact((transaction) => {
              transaction.markChangeLogProjected(change.changeId);
            });
          }
        }

        const remoteEntries = await config.sync.adapter.listLogEntries?.();

        if (!remoteEntries) {
          return;
        }

        const observedRemoteChangeIds = await readObservedRemoteChangeIds();
        const knownChangeIds = new Set(
          (await storage.listChanges()).map((change) => change.changeId),
        );

        for (const entry of remoteEntries) {
          if (
            knownChangeIds.has(entry.changeId) ||
            observedRemoteChangeIds.has(entry.changeId)
          ) {
            continue;
          }

          const definition = requireEntity(entry.entityName);
          const existingRecord = await storage.readEntity(
            entry.entityName,
            entry.entityId,
          );
          const nextGraph = applyTripleDelta(
            publicTriplesToRdfTriples(existingRecord?.graph ?? [], {
              rdfType: definition.rdfType,
            }),
            {
              assertions: publicTriplesToRdfTriples(entry.assertions, {
                rdfType: definition.rdfType,
              }),
              retractions: publicTriplesToRdfTriples(entry.retractions, {
                rdfType: definition.rdfType,
              }),
            },
          );
          const nextPublicGraph = rdfTriplesToPublicTriples(nextGraph);
          const entryAssertions = rdfTriplesToPublicTriples(
            publicTriplesToRdfTriples(entry.assertions, {
              rdfType: definition.rdfType,
            }),
          );
          const entryRetractions = rdfTriplesToPublicTriples(
            publicTriplesToRdfTriples(entry.retractions, {
              rdfType: definition.rdfType,
            }),
          );

          await storage.transact((transaction) => {
            if (nextPublicGraph.length === 0) {
              transaction.removeEntity(entry.entityName, entry.entityId);
            } else {
              const updatedOrder = transaction.nextUpdatedOrder();
              const nextProjection = definition.project(nextPublicGraph, {
                uri() {
                  return uri(existingRecord?.rootUri ?? entry.rootUri);
                },
                child(path) {
                  return uri(
                    `${existingRecord?.rootUri ?? entry.rootUri}#${path}`,
                  );
                },
              });

              transaction.writeEntity(entry.entityName, entry.entityId, {
                rootUri: existingRecord?.rootUri ?? entry.rootUri,
                graph: nextPublicGraph,
                projection: nextProjection,
                lastChangeId: entry.changeId,
                updatedOrder,
              });
            }

            transaction.appendChange({
              entityName: entry.entityName,
              entityId: entry.entityId,
              changeId: entry.changeId,
              parentChangeId: entry.parentChangeId,
              assertions: entryAssertions,
              retractions: entryRetractions,
              entityProjected: true,
              logProjected: true,
            });
          });

          knownChangeIds.add(entry.changeId);
        }
      },

      async bootstrap(): Promise<BootstrapResult> {
        if (!config.sync?.adapter.listCanonicalEntities) {
          return {
            imported: 0,
            skipped: 0,
            collisions: [],
          };
        }

        let imported = 0;
        let skipped = 0;
        const collisions: BootstrapResult["collisions"] = [];

        for (const definition of entities.values()) {
          const remoteEntities =
            await config.sync.adapter.listCanonicalEntities({
              entityName: definition.name,
              basePath: definition.pod.basePath,
              rdfType: definition.rdfType,
            });

          for (const remoteEntity of remoteEntities) {
            const existingRecord = await storage.readEntity(
              definition.name,
              remoteEntity.entityId,
            );

            if (existingRecord) {
              if (graphsMatch(existingRecord.graph, remoteEntity.graph)) {
                skipped += 1;
                continue;
              }

              collisions.push({
                entityName: definition.name,
                entityId: remoteEntity.entityId,
                path: remoteEntity.path,
              });
              continue;
            }

            const nextProjection = definition.project(
              remoteEntity.graph,
              createProjectionHelpers(remoteEntity.rootUri),
            );

            await storage.transact((transaction) => {
              const updatedOrder = transaction.nextUpdatedOrder();
              transaction.writeEntity(definition.name, remoteEntity.entityId, {
                rootUri: remoteEntity.rootUri,
                graph: remoteEntity.graph,
                projection: nextProjection,
                lastChangeId: null,
                updatedOrder,
              });
            });

            imported += 1;
          }
        }

        const remoteEntries = await config.sync.adapter.listLogEntries?.();

        if (remoteEntries) {
          await rememberObservedRemoteChangeIds(
            remoteEntries.map((entry) => entry.changeId),
          );
        }

        return {
          imported,
          skipped,
          collisions,
        };
      },
    },
  };
}
