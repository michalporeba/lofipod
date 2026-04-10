import {
  createEntityPatchRequest,
  createLogAppendRequest,
  hasPendingSync,
} from "../sync.js";
import type { EngineConfig, EntityDefinition } from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  entityPath,
  inferRootUri,
  requireEntityDefinition,
  requireLogBasePath,
} from "./support.js";
import {
  createLogRecord,
  isDeletionChange,
  markSupersededChangeProjected,
} from "./remote-shared.js";

async function projectPendingChange(
  storage: EngineStorage,
  config: EngineConfig,
  definition: EntityDefinition<unknown>,
  change: Awaited<ReturnType<EngineStorage["listChanges"]>>[number],
  record: Awaited<ReturnType<EngineStorage["readEntity"]>>,
): Promise<void> {
  if (!config.sync) {
    return;
  }

  const deletion = !record && isDeletionChange(change);

  if (!record && !deletion) {
    return;
  }

  if (!change.entityProjected) {
    if (deletion) {
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
      change.assertions.length > 0 ? change.assertions : change.retractions,
      record?.rootUri,
    );

    await config.sync.adapter.appendLogEntry(
      createLogAppendRequest(
        change,
        createLogRecord(rootUri),
        requireLogBasePath(config),
      ),
    );

    await storage.transact((transaction) => {
      transaction.markChangeLogProjected(change.changeId);
    });
  }
}

export async function syncPendingChanges(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<number> {
  if (!config.sync) {
    return 0;
  }

  const pendingChanges = storage.listPendingChanges
    ? await storage.listPendingChanges()
    : (await storage.listChanges()).filter(hasPendingSync);
  const deletedEntities = new Set<string>();

  let changesPushed = 0;

  for (const change of pendingChanges) {
    if (!isDeletionChange(change)) {
      continue;
    }

    const record = await storage.readEntity(change.entityName, change.entityId);

    if (!record) {
      deletedEntities.add(`${change.entityName}:${change.entityId}`);
    }
  }

  for (const change of pendingChanges) {
    const definition = requireEntityDefinition(entities, change.entityName);
    const record = await storage.readEntity(change.entityName, change.entityId);

    if (!record && !isDeletionChange(change)) {
      if (deletedEntities.has(`${change.entityName}:${change.entityId}`)) {
        await markSupersededChangeProjected(storage, change.changeId);
      }

      continue;
    }

    await projectPendingChange(storage, config, definition, change, record);
    changesPushed += 1;
  }

  return changesPushed;
}
