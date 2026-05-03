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
import {
  bootstrapFromCanonicalResources,
  replayRemoteLogEntries,
  syncNow,
} from "./engine/remote.js";
import { reconcileCanonicalResources } from "./engine/remote-canonical.js";
import { syncPendingChanges } from "./engine/remote-push.js";
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
  validateEntityDefinitions(config.entities);

  const entities = new Map(
    config.entities.map((entity) => [entity.kind, entity]),
  );
  const storage = (config.storage ?? createMemoryStorage()) as EngineStorage;
  const logger = config.logger;
  let currentPodConfig = createRuntimePodConfig(config.pod);
  let currentSyncConfig = config.sync;
  let queuedSync = Promise.resolve();
  let pendingInitialSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingBackgroundSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let startupSyncGeneration = 0;
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

  const runStartupSyncCycle = async (
    expectedGeneration: number,
  ): Promise<void> => {
    if (!currentSyncConfig) {
      return;
    }

    setSyncing(true);

    try {
      await syncPendingChanges(storage, entities, runtimeConfig());
      await replayRemoteLogEntries(storage, entities, runtimeConfig());
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      if (expectedGeneration !== startupSyncGeneration) {
        return;
      }

      await reconcileCanonicalResources(storage, entities, runtimeConfig());
      await persistSyncSuccess(storage, createTimestamp());
      emitSyncStateChange();
    } catch (error) {
      await persistSyncFailure(
        storage,
        createTimestamp(),
        error instanceof Error ? error.message : String(error),
      );
      if (logger) {
        logWarn(logger, "sync:startup-failure", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      emitSyncStateChange();
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

  const enqueueStartupSyncCycle = (generation: number): Promise<void> => {
    const task = queuedSync
      .catch(() => {
        // Continue processing startup sync after an earlier failure.
      })
      .then(() => runStartupSyncCycle(generation));

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

    if (pendingBackgroundSyncTimer !== null) {
      clearTimeout(pendingBackgroundSyncTimer);
    }

    pendingBackgroundSyncTimer = setTimeout(() => {
      pendingBackgroundSyncTimer = null;
      void runSyncNow(true);
    }, 0);
  };
  const clearPendingInitialSync = (): void => {
    if (pendingInitialSyncTimer === null) {
      return;
    }

    clearTimeout(pendingInitialSyncTimer);
    pendingInitialSyncTimer = null;
  };
  const clearPendingBackgroundSync = (): void => {
    if (pendingBackgroundSyncTimer === null) {
      return;
    }

    clearTimeout(pendingBackgroundSyncTimer);
    pendingBackgroundSyncTimer = null;
  };
  const scheduleInitialSync = (): void => {
    if (
      pendingInitialSyncTimer !== null ||
      !currentSyncConfig ||
      !currentPodConfig?.logBasePath
    ) {
      return;
    }

    pendingInitialSyncTimer = setTimeout(() => {
      pendingInitialSyncTimer = null;
      const generation = startupSyncGeneration;
      void enqueueStartupSyncCycle(generation);
    }, 0);
  };
  const supersedeStartupSync = (): void => {
    startupSyncGeneration += 1;
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
    scheduleInitialSync();
  }

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      supersedeStartupSync();
      clearPendingInitialSync();
      clearPendingBackgroundSync();
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
      supersedeStartupSync();
      clearPendingInitialSync();
      clearPendingBackgroundSync();
      await deleteEntity(storage, requireEntity(entityName), id);
      emitSyncStateChange();
      queueBackgroundSync();
    },

    async dispose(): Promise<void> {
      supersedeStartupSync();
      clearPendingInitialSync();
      clearPendingBackgroundSync();
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
        supersedeStartupSync();
        clearPendingInitialSync();
        clearPendingBackgroundSync();
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

        if (syncConfig.startBackground !== false) {
          await notifications.start();
          polling.start();
          scheduleInitialSync();
        }
        if (logger) {
          logInfo(logger, "sync:attached", {
            podBaseUrl: syncConfig.podBaseUrl,
            logBasePath: normalizeLogBasePath(syncConfig.logBasePath),
          });
        }
        emitSyncStateChange();
      },

      async detach(): Promise<void> {
        supersedeStartupSync();
        clearPendingInitialSync();
        clearPendingBackgroundSync();
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
        supersedeStartupSync();
        clearPendingInitialSync();
        clearPendingBackgroundSync();
        return runSyncNow(false);
      },

      async bootstrap(): Promise<BootstrapResult> {
        if (!currentSyncConfig) {
          throw new Error("Sync adapter is not attached.");
        }

        const pendingChanges = storage.listPendingChanges
          ? await storage.listPendingChanges()
          : (await storage.listChanges()).filter(
              (change) => !change.entityProjected || !change.logProjected,
            );

        if (pendingChanges.length > 0) {
          clearPendingInitialSync();
          clearPendingBackgroundSync();
        } else {
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
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
              reconciled: result.reconciled.length,
              unsupported: result.unsupported.length,
              collisions: result.collisions.length,
            });
          }
          return result;
        });
      },
    },
  };
}

function validateEntityDefinitions(
  definitions: EntityDefinition<unknown>[],
): void {
  const seenKinds = new Set<string>();

  for (const definition of definitions) {
    if (seenKinds.has(definition.kind)) {
      throw new Error(
        `createEngine: duplicate entity kind "${definition.kind}" is not allowed.`,
      );
    }

    seenKinds.add(definition.kind);
  }
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
