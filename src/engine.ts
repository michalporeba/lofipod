import { createMemoryStorage } from "./storage/memory.js";
import { logInfo, logWarn } from "./logger.js";
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
import { createNotificationManager } from "./engine/notifications.js";
import { createPollingManager } from "./engine/polling.js";
import { bootstrapFromCanonicalResources, syncNow } from "./engine/remote.js";
import {
  createRuntimeSyncState,
  persistSyncFailure,
  persistSyncSuccess,
} from "./engine/sync-state.js";
import {
  createTimestamp,
  requireEntityDefinition,
  type EngineStorage,
} from "./engine/support.js";

export function createEngine(config: EngineConfig): Engine {
  const entities = new Map(
    config.entities.map((entity) => [entity.name, entity]),
  );
  const storage = (config.storage ?? createMemoryStorage()) as EngineStorage;
  const logger = config.logger;
  let currentPodConfig = createRuntimePodConfig(config.pod);
  let currentSyncConfig = config.sync;
  let queuedSync = Promise.resolve();
  const runtimeSyncState = createRuntimeSyncState();
  const syncStateListeners = new Set<(state: SyncState) => void>();
  let lastEmittedSyncState = "";
  let syncStateEmissionVersion = 0;

  const requireEntity = (entityName: string): EntityDefinition<unknown> =>
    requireEntityDefinition(entities, entityName);

  const runtimeConfig = (): EngineConfig => ({
    ...config,
    logger,
    pod: currentPodConfig,
    sync: currentSyncConfig,
  });

  if (logger) {
    currentSyncConfig?.adapter.setLogger?.(logger);
  }

  const emitSyncStateChange = (): void => {
    const emissionVersion = ++syncStateEmissionVersion;

    void readSyncState(storage, currentSyncConfig, runtimeSyncState)
      .then((state) => {
        if (emissionVersion !== syncStateEmissionVersion) {
          return;
        }

        const serialized = JSON.stringify(state);

        if (serialized === lastEmittedSyncState) {
          return;
        }

        lastEmittedSyncState = serialized;

        for (const listener of syncStateListeners) {
          listener(state);
        }
      })
      .catch(() => {
        // Sync state emission should never break engine behaviour.
      });
  };

  const setSyncing = (syncing: boolean): void => {
    if (runtimeSyncState.syncing === syncing) {
      return;
    }

    runtimeSyncState.syncing = syncing;
    emitSyncStateChange();
  };

  const setNotificationsActive = (active: boolean): void => {
    if (runtimeSyncState.notificationsActive === active) {
      return;
    }

    runtimeSyncState.notificationsActive = active;
    emitSyncStateChange();
  };

  const runSyncCycle = async (): Promise<void> => {
    if (!currentSyncConfig) {
      return;
    }

    setSyncing(true);

    try {
      await syncNow(storage, entities, runtimeConfig());
      await persistSyncSuccess(storage, createTimestamp());
      emitSyncStateChange();
    } catch (error) {
      await persistSyncFailure(
        storage,
        createTimestamp(),
        error instanceof Error ? error.message : String(error),
      );
      if (logger) {
        logWarn(logger, "sync:failure", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      emitSyncStateChange();
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  const enqueueSyncCycle = (): Promise<void> => {
    const task = queuedSync
      .catch(() => {
        // Continue processing later sync attempts after an earlier failure.
      })
      .then(() => runSyncCycle());

    queuedSync = task;

    return task;
  };

  const runSyncNow = (suppressErrors: boolean): Promise<void> => {
    const task = enqueueSyncCycle();

    return suppressErrors
      ? task.catch(() => {
          // Background-triggered sync should not surface failures directly.
        })
      : task;
  };
  const queueBackgroundSync = (): void => {
    if (!currentSyncConfig || !currentPodConfig?.logBasePath) {
      return;
    }

    void runSyncNow(true);
  };
  const notifications = createNotificationManager({
    entities,
    getConfig: runtimeConfig,
    runSyncNow,
    setNotificationsActive,
    logger,
  });
  const polling = createPollingManager({
    getConfig: runtimeConfig,
    runSyncCycle: enqueueSyncCycle,
    refreshNotifications: notifications.start,
  });

  if (currentSyncConfig && currentPodConfig?.logBasePath) {
    void notifications.start();
    polling.start();
    queueBackgroundSync();
  }

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      const saved = await saveEntity(
        storage,
        requireEntity(entityName) as EntityDefinition<T>,
        entity,
      );

      emitSyncStateChange();
      queueBackgroundSync();

      return saved;
    },

    async delete(entityName: string, id: string): Promise<void> {
      await deleteEntity(storage, requireEntity(entityName), id);
      emitSyncStateChange();
      queueBackgroundSync();
    },

    async dispose(): Promise<void> {
      polling.stop();
      await notifications.stop();
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
          pollIntervalMs: syncConfig.pollIntervalMs,
        };
        if (logger) {
          currentSyncConfig.adapter.setLogger?.(logger);
        }

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

        await notifications.start();
        polling.start();
        queueBackgroundSync();
        if (logger) {
          logInfo(logger, "sync:attached", {
            podBaseUrl: syncConfig.podBaseUrl,
            logBasePath: normalizeLogBasePath(syncConfig.logBasePath),
          });
        }
        emitSyncStateChange();
      },

      async detach(): Promise<void> {
        polling.stop();
        await notifications.stop();
        currentPodConfig = undefined;
        currentSyncConfig = undefined;

        await storage.transact((transaction) => {
          const metadata = transaction.readSyncMetadata();

          transaction.writeSyncMetadata({
            ...metadata,
            persistedPodConfig: null,
          });
        });

        logInfo(logger, "sync:detached");
        emitSyncStateChange();
      },

      async persistedConfig(): Promise<PersistedPodConfig | null> {
        const metadata = await storage.readSyncMetadata();
        return metadata.persistedPodConfig;
      },

      async state(): Promise<SyncState> {
        return readSyncState(storage, currentSyncConfig, runtimeSyncState);
      },

      onStateChange(callback: (state: SyncState) => void): () => void {
        syncStateListeners.add(callback);

        return () => {
          syncStateListeners.delete(callback);
        };
      },

      async now(): Promise<void> {
        return runSyncNow(false);
      },

      async bootstrap(): Promise<BootstrapResult> {
        if (!currentSyncConfig) {
          throw new Error("Sync adapter is not attached.");
        }

        return bootstrapFromCanonicalResources(
          storage,
          entities,
          runtimeConfig(),
        ).then((result) => {
          if (logger) {
            logInfo(logger, "sync:bootstrap", {
              imported: result.imported,
              skipped: result.skipped,
              collisions: result.collisions.length,
            });
          }
          return result;
        });
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
