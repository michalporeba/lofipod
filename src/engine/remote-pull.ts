import { applyTripleDelta } from "../graph.js";
import { logWarn } from "../logger.js";
import {
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import type { EngineConfig, EntityDefinition } from "../types.js";
import { reconcileForksAfterPull } from "./remote-merge.js";
import type { EngineStorage } from "./support.js";
import {
  createMigrationFailureError,
  createRemoteProjectionHelpers,
  createTimestamp,
  rememberMigrationOutcome,
  readObservedRemoteChangeIds,
  requireLogBasePath,
  requireEntityDefinition,
} from "./support.js";

export async function replayRemoteLogEntries(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<number> {
  const remoteEntries = await config.sync?.adapter.listLogEntries?.({
    logBasePath: requireLogBasePath(config),
  });

  if (!remoteEntries) {
    return 0;
  }

  const observedRemoteChangeIds = await readObservedRemoteChangeIds(storage);
  const knownChangeIds = new Set(
    (await storage.listChanges()).map((change) => change.changeId),
  );
  const touchedEntities = new Set<string>();
  let entriesReplayed = 0;

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
        let nextProjection: unknown;
        try {
          nextProjection = definition.project(
            nextPublicGraph,
            createRemoteProjectionHelpers(
              existingRecord?.rootUri ?? entry.rootUri,
            ),
          );
        } catch (error) {
          throw createMigrationFailureError({
            entityName: entry.entityName,
            entityId: entry.entityId,
            phase: "remote-log-replay",
            cause: error,
          });
        }

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
        timestamp: entry.timestamp,
        assertions: entryAssertions,
        retractions: entryRetractions,
        entityProjected: true,
        logProjected: true,
      });
    });

    knownChangeIds.add(entry.changeId);
    touchedEntities.add(`${entry.entityName}:${entry.entityId}`);
    entriesReplayed += 1;
    try {
      await rememberMigrationOutcome(storage, {
        scope: "canonical-remote",
        entityName: entry.entityName,
        entityId: entry.entityId,
        phase: "remote-log-replay",
        action: "migrated",
        reason: null,
        at: createTimestamp(),
      });
    } catch (error) {
      logWarn(config.logger, "sync:migration-outcome-persist-failure", {
        entityName: entry.entityName,
        entityId: entry.entityId,
        phase: "remote-log-replay",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await reconcileForksAfterPull(storage, entities, touchedEntities);
  return entriesReplayed;
}
