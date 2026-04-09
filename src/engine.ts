import { createMemoryStorage } from "./storage/memory.js";
import { normalizeLogBasePath, readSyncState } from "./sync.js";
import type {
  BootstrapResult,
  Engine,
  EngineConfig,
  EntityDefinition,
  PersistedPodConfig,
  SyncState,
} from "./types.js";
import {
  deleteEntity,
  getEntity,
  listEntities,
  saveEntity,
} from "./engine/local.js";
import { bootstrapFromCanonicalResources, syncNow } from "./engine/remote.js";
import {
  requireEntityDefinition,
  type EngineStorage,
} from "./engine/support.js";

export function createEngine(config: EngineConfig): Engine {
  const entities = new Map(
    config.entities.map((entity) => [entity.name, entity]),
  );
  const storage = (config.storage ?? createMemoryStorage()) as EngineStorage;
  let currentPodConfig = createRuntimePodConfig(config.pod);
  let currentSyncConfig = config.sync;

  const requireEntity = (entityName: string): EntityDefinition<unknown> =>
    requireEntityDefinition(entities, entityName);

  const runtimeConfig = (): EngineConfig => ({
    ...config,
    pod: currentPodConfig,
    sync: currentSyncConfig,
  });

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      return saveEntity(
        storage,
        requireEntity(entityName) as EntityDefinition<T>,
        entity,
      );
    },

    async delete(entityName: string, id: string): Promise<void> {
      return deleteEntity(storage, requireEntity(entityName), id);
    },

    async get<T>(entityName: string, id: string): Promise<T | null> {
      return getEntity(
        storage,
        requireEntity(entityName) as EntityDefinition<T>,
        id,
      );
    },

    async list<T>(
      entityName: string,
      options?: { limit?: number },
    ): Promise<T[]> {
      return listEntities(
        storage,
        requireEntity(entityName) as EntityDefinition<T>,
        options,
      );
    },

    sync: {
      async attach(syncConfig): Promise<void> {
        currentPodConfig = {
          podBaseUrl: syncConfig.podBaseUrl,
          logBasePath: normalizeLogBasePath(syncConfig.logBasePath),
        };
        currentSyncConfig = {
          adapter: syncConfig.adapter,
        };

        await storage.transact((transaction) => {
          const metadata = transaction.readSyncMetadata();

          transaction.writeSyncMetadata({
            ...metadata,
            persistedPodConfig: {
              podBaseUrl: syncConfig.podBaseUrl,
              logBasePath: normalizeLogBasePath(syncConfig.logBasePath),
            },
          });
        });
      },

      async detach(): Promise<void> {
        currentPodConfig = undefined;
        currentSyncConfig = undefined;

        await storage.transact((transaction) => {
          const metadata = transaction.readSyncMetadata();

          transaction.writeSyncMetadata({
            ...metadata,
            persistedPodConfig: null,
          });
        });
      },

      async persistedConfig(): Promise<PersistedPodConfig | null> {
        const metadata = await storage.readSyncMetadata();
        return metadata.persistedPodConfig;
      },

      async state(): Promise<SyncState> {
        return readSyncState(storage, currentSyncConfig);
      },

      async now(): Promise<void> {
        return syncNow(storage, entities, runtimeConfig());
      },

      async bootstrap(): Promise<BootstrapResult> {
        if (!currentSyncConfig) {
          throw new Error("Sync adapter is not attached.");
        }

        return bootstrapFromCanonicalResources(
          storage,
          entities,
          runtimeConfig(),
        );
      },
    },
  };
}

function createRuntimePodConfig(
  podConfig: EngineConfig["pod"],
): EngineConfig["pod"] | undefined {
  if (!podConfig?.logBasePath) {
    return undefined;
  }

  return {
    logBasePath: normalizeLogBasePath(podConfig.logBasePath),
    podBaseUrl: podConfig.podBaseUrl,
  };
}
