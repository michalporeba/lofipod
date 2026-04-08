import { createMemoryStorage } from "./storage/memory.js";
import { readSyncState } from "./sync.js";
import type {
  BootstrapResult,
  Engine,
  EngineConfig,
  EntityDefinition,
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

  const requireEntity = (entityName: string): EntityDefinition<unknown> =>
    requireEntityDefinition(entities, entityName);

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
      async state(): Promise<SyncState> {
        return readSyncState(storage, config.sync);
      },

      async now(): Promise<void> {
        return syncNow(storage, entities, config);
      },

      async bootstrap(): Promise<BootstrapResult> {
        return bootstrapFromCanonicalResources(storage, entities, config);
      },
    },
  };
}
