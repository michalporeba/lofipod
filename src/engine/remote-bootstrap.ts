import { createProjectionHelpers, diffTriples, graphsMatch } from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import type {
  BootstrapResult,
  EngineConfig,
  EntityDefinition,
} from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createChangeId,
  createTimestamp,
  createRemoteProjectionHelpers,
  inferRootUri,
  rememberObservedRemoteChangeIds,
  requireLogBasePath,
} from "./support.js";
import { mergeSupportedGraphs } from "./supported-merge.js";

export async function bootstrapFromCanonicalResources(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<BootstrapResult> {
  if (!config.sync?.adapter.listCanonicalEntities) {
    return {
      imported: 0,
      skipped: 0,
      reconciled: [],
      unsupported: [],
      collisions: [],
    };
  }

  let imported = 0;
  let skipped = 0;
  const reconciled: BootstrapResult["reconciled"] = [];
  const unsupported: BootstrapResult["unsupported"] = [];
  const collisions: BootstrapResult["collisions"] = [];

  for (const definition of entities.values()) {
    const remoteEntities = await config.sync.adapter.listCanonicalEntities({
      entityName: definition.kind,
      basePath: definition.pod.basePath,
      rdfType: definition.rdfType,
    });

    for (const remoteEntity of remoteEntities) {
      const existingRecord = await storage.readEntity(
        definition.kind,
        remoteEntity.entityId,
      );

      if (existingRecord) {
        if (graphsMatch(existingRecord.graph, remoteEntity.graph)) {
          skipped += 1;
          continue;
        }

        const merge = mergeSupportedGraphs(
          existingRecord.graph,
          remoteEntity.graph,
          definition,
        );

        if (!merge.ok) {
          const unsupportedItem = {
            entityName: definition.kind,
            entityId: remoteEntity.entityId,
            path: remoteEntity.path,
            reason: merge.reason,
          };
          unsupported.push(unsupportedItem);
          collisions.push({
            entityName: definition.kind,
            entityId: remoteEntity.entityId,
            path: remoteEntity.path,
          });
          continue;
        }

        const rootUri = inferRootUri(
          definition,
          remoteEntity.entityId,
          merge.graph,
          existingRecord.rootUri,
        );
        const projection = definition.project(
          merge.graph,
          createProjectionHelpers(rootUri),
        );
        const changeId = createChangeId();
        const timestamp = createTimestamp();

        await storage.transact((transaction) => {
          const latest = transaction.readEntity(
            definition.kind,
            remoteEntity.entityId,
          );

          if (!latest || graphsMatch(latest.graph, merge.graph)) {
            return;
          }

          const current = publicTriplesToRdfTriples(latest.graph, {
            rdfType: definition.rdfType,
          });
          const next = publicTriplesToRdfTriples(merge.graph, {
            rdfType: definition.rdfType,
          });
          const delta = diffTriples(current, next);
          const updatedOrder = transaction.nextUpdatedOrder();

          transaction.writeEntity(definition.kind, remoteEntity.entityId, {
            rootUri,
            graph: merge.graph,
            projection,
            lastChangeId: changeId,
            updatedOrder,
          });
          transaction.appendChange({
            entityName: definition.kind,
            entityId: remoteEntity.entityId,
            changeId,
            parentChangeId: latest.lastChangeId,
            timestamp,
            assertions: rdfTriplesToPublicTriples(delta.assertions),
            retractions: rdfTriplesToPublicTriples(delta.retractions),
            entityProjected: false,
            logProjected: false,
          });
        });

        reconciled.push({
          entityName: definition.kind,
          entityId: remoteEntity.entityId,
          path: remoteEntity.path,
          resolution: "merged",
        });
        continue;
      }

      const nextProjection = definition.project(
        remoteEntity.graph,
        createRemoteProjectionHelpers(remoteEntity.rootUri),
      );

      await storage.transact((transaction) => {
        const updatedOrder = transaction.nextUpdatedOrder();
        transaction.writeEntity(definition.kind, remoteEntity.entityId, {
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

  const remoteEntries = await config.sync?.adapter.listLogEntries?.({
    logBasePath: requireLogBasePath(config),
  });

  if (remoteEntries) {
    await rememberObservedRemoteChangeIds(
      storage,
      remoteEntries.map((entry) => entry.changeId),
    );
  }

  return {
    imported,
    skipped,
    reconciled,
    unsupported,
    collisions,
  };
}
