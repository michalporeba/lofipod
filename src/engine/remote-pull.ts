import { applyTripleDelta } from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import type { EngineConfig, EntityDefinition } from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createRemoteProjectionHelpers,
  readObservedRemoteChangeIds,
  requireEntityDefinition,
} from "./support.js";

export async function replayRemoteLogEntries(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<void> {
  const remoteEntries = await config.sync?.adapter.listLogEntries?.();

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
