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
): Promise<void> {
  if (!config.sync) {
    return;
  }

  const record = await storage.readEntity(change.entityName, change.entityId);
  const deletion = isDeletionChange(change);

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
): Promise<void> {
  if (!config.sync) {
    return;
  }

  const pendingChanges = storage.listPendingChanges
    ? await storage.listPendingChanges()
    : (await storage.listChanges()).filter(hasPendingSync);
  const deletedEntities = new Set(
    pendingChanges
      .filter(isDeletionChange)
      .map((change) => `${change.entityName}:${change.entityId}`),
  );

  for (const change of pendingChanges) {
    const definition = requireEntityDefinition(entities, change.entityName);
    const record = await storage.readEntity(change.entityName, change.entityId);

    if (!record && !isDeletionChange(change)) {
      if (deletedEntities.has(`${change.entityName}:${change.entityId}`)) {
        await markSupersededChangeProjected(storage, change.changeId);
      }

      continue;
    }

    await projectPendingChange(storage, config, definition, change);
  }
}
