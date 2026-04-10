import { diffTriples, graphsMatch } from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import { hasPendingSync } from "../sync.js";
import type {
  EngineConfig,
  EntityDefinition,
  StoredEntityRecord,
  Triple,
} from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createChangeId,
  createRemoteProjectionHelpers,
  createTimestamp,
} from "./support.js";

export async function reconcileCanonicalResources(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<number> {
  if (!config.sync?.adapter.checkCanonicalResources) {
    return 0;
  }

  const metadata = await storage.readSyncMetadata();
  let entitiesReconciled = 0;

  for (const definition of entities.values()) {
    const previousVersion =
      metadata.canonicalContainerVersions[definition.name] ?? null;
    const hasLocalEntities =
      (await storage.listEntities(definition.name)).length > 0;
    const remote = await config.sync.adapter.checkCanonicalResources({
      entityName: definition.name,
      basePath: definition.pod.basePath,
      rdfType: definition.rdfType,
      previousVersion,
    });

    await persistCanonicalContainerVersion(
      storage,
      definition.name,
      remote.version,
    );

    if (!remote.changed) {
      continue;
    }

    if (previousVersion === null && hasLocalEntities) {
      continue;
    }

    entitiesReconciled += await reconcileCanonicalContainer(
      storage,
      definition,
      remote.entities,
      await readPendingEntityIds(storage, definition.name),
    );
  }

  return entitiesReconciled;
}

async function reconcileCanonicalContainer(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  remoteEntities: {
    entityId: string;
    path: string;
    rootUri: string;
    graph: Triple[];
  }[],
  pendingEntityIds: Set<string>,
): Promise<number> {
  const localRecords = await storage.listEntities(definition.name);
  const localById = new Map(
    localRecords.map(({ entityId, record }) => [entityId, record]),
  );
  const remoteById = new Map(
    remoteEntities.map((entity) => [entity.entityId, entity]),
  );
  let reconciled = 0;

  for (const remoteEntity of remoteEntities) {
    if (pendingEntityIds.has(remoteEntity.entityId)) {
      continue;
    }

    const localRecord = localById.get(remoteEntity.entityId);

    if (!localRecord) {
      await importExternalCanonicalEntity(storage, definition, remoteEntity);
      reconciled += 1;
      continue;
    }

    if (graphsMatch(localRecord.graph, remoteEntity.graph)) {
      continue;
    }

    await reconcileExternalCanonicalUpdate(
      storage,
      definition,
      remoteEntity.entityId,
      localRecord,
      remoteEntity,
    );
    reconciled += 1;
  }

  for (const { entityId } of localRecords) {
    if (pendingEntityIds.has(entityId)) {
      continue;
    }

    if (remoteById.has(entityId)) {
      continue;
    }

    await reconcileExternalCanonicalDeletion(storage, definition, entityId);
    reconciled += 1;
  }

  return reconciled;
}

async function readPendingEntityIds(
  storage: EngineStorage,
  entityName: string,
): Promise<Set<string>> {
  const pendingChanges = storage.listPendingChanges
    ? await storage.listPendingChanges()
    : (await storage.listChanges(entityName)).filter(hasPendingSync);

  return new Set(
    pendingChanges
      .filter((change) => change.entityName === entityName)
      .map((change) => change.entityId),
  );
}

async function importExternalCanonicalEntity(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  remoteEntity: {
    entityId: string;
    rootUri: string;
    graph: Triple[];
  },
): Promise<void> {
  const changeId = createChangeId();
  const projection = definition.project(
    remoteEntity.graph,
    createRemoteProjectionHelpers(remoteEntity.rootUri),
  );

  await storage.transact((transaction) => {
    const latest = transaction.readEntity(
      definition.name,
      remoteEntity.entityId,
    );

    if (latest) {
      return;
    }

    const updatedOrder = transaction.nextUpdatedOrder();

    transaction.writeEntity(definition.name, remoteEntity.entityId, {
      rootUri: remoteEntity.rootUri,
      graph: remoteEntity.graph,
      projection,
      lastChangeId: changeId,
      updatedOrder,
    });
    transaction.appendChange({
      entityName: definition.name,
      entityId: remoteEntity.entityId,
      changeId,
      parentChangeId: null,
      timestamp: createTimestamp(),
      assertions: remoteEntity.graph,
      retractions: [],
      entityProjected: true,
      logProjected: false,
    });
  });
}

async function reconcileExternalCanonicalUpdate(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  entityId: string,
  localRecord: StoredEntityRecord<unknown>,
  remoteEntity: {
    rootUri: string;
    graph: Triple[];
  },
): Promise<void> {
  const diff = diffTriples(
    publicTriplesToRdfTriples(localRecord.graph, {
      rdfType: definition.rdfType,
    }),
    publicTriplesToRdfTriples(remoteEntity.graph, {
      rdfType: definition.rdfType,
    }),
  );
  const assertions = rdfTriplesToPublicTriples(diff.assertions);
  const retractions = rdfTriplesToPublicTriples(diff.retractions);
  const projection = definition.project(
    remoteEntity.graph,
    createRemoteProjectionHelpers(remoteEntity.rootUri),
  );
  const changeId = createChangeId();

  await storage.transact((transaction) => {
    const latest = transaction.readEntity(definition.name, entityId);

    if (!latest || graphsMatch(latest.graph, remoteEntity.graph)) {
      return;
    }

    const updatedOrder = transaction.nextUpdatedOrder();

    transaction.writeEntity(definition.name, entityId, {
      rootUri: remoteEntity.rootUri,
      graph: remoteEntity.graph,
      projection,
      lastChangeId: changeId,
      updatedOrder,
    });
    transaction.appendChange({
      entityName: definition.name,
      entityId,
      changeId,
      parentChangeId: latest.lastChangeId,
      timestamp: createTimestamp(),
      assertions,
      retractions,
      entityProjected: true,
      logProjected: false,
    });
  });
}

async function reconcileExternalCanonicalDeletion(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  entityId: string,
): Promise<void> {
  const changeId = createChangeId();

  await storage.transact((transaction) => {
    const latest = transaction.readEntity(definition.name, entityId);

    if (!latest) {
      return;
    }

    transaction.removeEntity(definition.name, entityId);
    transaction.appendChange({
      entityName: definition.name,
      entityId,
      changeId,
      parentChangeId: latest.lastChangeId,
      timestamp: createTimestamp(),
      assertions: [],
      retractions: latest.graph,
      entityProjected: true,
      logProjected: false,
    });
  });
}

async function persistCanonicalContainerVersion(
  storage: EngineStorage,
  entityName: string,
  version: string | null,
): Promise<void> {
  await storage.transact((transaction) => {
    const metadata = transaction.readSyncMetadata();
    const nextVersions = {
      ...metadata.canonicalContainerVersions,
    };

    if (version === null) {
      delete nextVersions[entityName];
    } else {
      nextVersions[entityName] = version;
    }

    transaction.writeSyncMetadata({
      ...metadata,
      canonicalContainerVersions: nextVersions,
    });
  });
}
