import { createMemoryStorage } from "./storage/memory.js";
import {
  createStoredRecord,
  createToRdfHelpers,
  diffTriples,
  fallbackRootUri,
  projectionsMatch,
  projectStoredRecord,
} from "./graph.js";
import {
  createEntityPatchRequest,
  createLogAppendRequest,
  hasPendingSync,
  normalizeLogBasePath,
  readSyncState,
} from "./sync.js";
import type {
  Engine,
  EngineConfig,
  EntityDefinition,
  StoredEntityRecord,
  SyncState,
} from "./types.js";

function createChangeId(entityName: string, id: string): string {
  return `${entityName}:${id}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
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

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const entityId = definition.id(entity);
      const rootUri =
        definition.uri?.(entity) ?? fallbackRootUri(definition.name, entityId);
      const previousRecord = await storage.readEntity(
        definition.name,
        entityId,
      );
      const graph = definition.toRdf(entity, createToRdfHelpers(rootUri));
      const { assertions, retractions } = diffTriples(
        previousRecord?.graph ?? [],
        graph,
      );

      if (assertions.length === 0 && retractions.length === 0) {
        return (previousRecord?.projection as T) ?? entity;
      }

      const changeId = createChangeId(definition.name, entityId);

      const storedRecord = await storage.transact((transaction) => {
        const updatedOrder = transaction.nextUpdatedOrder();
        const nextRecord = createStoredRecord(
          definition,
          entity,
          graph,
          changeId,
          updatedOrder,
        );

        transaction.writeEntity(definition.name, entityId, nextRecord);
        transaction.appendChange({
          entityName: definition.name,
          entityId,
          changeId,
          parentChangeId: previousRecord?.lastChangeId ?? null,
          assertions,
          retractions,
          entityProjected: false,
          logProjected: false,
        });

        return nextRecord;
      });

      return storedRecord.projection as T;
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

        const pendingChanges = (await storage.listChanges()).filter(
          hasPendingSync,
        );

        for (const change of pendingChanges) {
          const definition = requireEntity(change.entityName);
          const record = await storage.readEntity(
            change.entityName,
            change.entityId,
          );

          if (!record) {
            continue;
          }

          if (!change.entityProjected) {
            await config.sync.adapter.applyEntityPatch(
              createEntityPatchRequest(definition, record, change),
            );

            await storage.transact((transaction) => {
              transaction.markChangeEntityProjected(change.changeId);
            });
          }

          if (!change.logProjected) {
            await config.sync.adapter.appendLogEntry(
              createLogAppendRequest(change, requireLogBasePath()),
            );

            await storage.transact((transaction) => {
              transaction.markChangeLogProjected(change.changeId);
            });
          }
        }
      },
    },
  };
}
