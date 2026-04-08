import { graphsMatch } from "../graph.js";
import type {
  BootstrapResult,
  EngineConfig,
  EntityDefinition,
} from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createRemoteProjectionHelpers,
  rememberObservedRemoteChangeIds,
} from "./support.js";

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
