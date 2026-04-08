import { applyTripleDelta, graphsMatch } from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import {
  createEntityPatchRequest,
  createLogAppendRequest,
  hasPendingSync,
} from "../sync.js";
import type {
  BootstrapResult,
  EngineConfig,
  EntityDefinition,
  StoredEntityRecord,
} from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createRemoteProjectionHelpers,
  entityPath,
  inferRootUri,
  readObservedRemoteChangeIds,
  rememberObservedRemoteChangeIds,
  requireEntityDefinition,
  requireLogBasePath,
} from "./support.js";

function isDeletionChange(change: {
  assertions: unknown[];
  retractions: unknown[];
}): boolean {
  return change.assertions.length === 0 && change.retractions.length > 0;
}

function createLogRecord(rootUri: string): StoredEntityRecord<unknown> {
  return {
    rootUri,
    graph: [],
    projection: null,
    lastChangeId: null,
    updatedOrder: 0,
  };
}

async function markSupersededChangeProjected(
  storage: EngineStorage,
  changeId: string,
): Promise<void> {
  await storage.transact((transaction) => {
    transaction.markChangeEntityProjected(changeId);
    transaction.markChangeLogProjected(changeId);
  });
}

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

export async function syncNow(
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

  const remoteEntries = await config.sync.adapter.listLogEntries?.();

  if (!remoteEntries) {
    return;
  }

  const observedRemoteChangeIds = await readObservedRemoteChangeIds(storage);
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

    const definition = requireEntityDefinition(entities, entry.entityName);
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
        const nextProjection = definition.project(
          nextPublicGraph,
          createRemoteProjectionHelpers(
            existingRecord?.rootUri ?? entry.rootUri,
          ),
        );

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
}

export async function bootstrapFromCanonicalResources(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<BootstrapResult> {
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
    const remoteEntities = await config.sync.adapter.listCanonicalEntities({
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
        createRemoteProjectionHelpers(remoteEntity.rootUri),
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

  const remoteEntries = await config.sync?.adapter.listLogEntries?.();

  if (remoteEntries) {
    await rememberObservedRemoteChangeIds(
      storage,
      remoteEntries.map((entry) => entry.changeId),
    );
  }

  return {
    imported,
    skipped,
    collisions,
  };
}
