import { createProjectionHelpers, diffTriples, graphsMatch } from "../graph.js";
import {
  isNamedNodeTerm,
  publicTriplesToRdfTriples,
  rdfTermToN3,
  rdfTripleKey,
  rdfTriplesToPublicTriples,
  type RdfTriple,
} from "../rdf.js";
import type {
  BootstrapResult,
  EngineConfig,
  EntityDefinition,
  Triple,
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

        const merge = mergeSupportedBootstrapGraphs(
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

function mergeSupportedBootstrapGraphs(
  localGraph: Triple[],
  remoteGraph: Triple[],
  definition: EntityDefinition<unknown>,
): { ok: true; graph: Triple[] } | { ok: false; reason: string } {
  const local = publicTriplesToRdfTriples(localGraph, {
    rdfType: definition.rdfType,
  });
  const remote = publicTriplesToRdfTriples(remoteGraph, {
    rdfType: definition.rdfType,
  });
  const localByKey = groupBySubjectPredicate(local);
  const remoteByKey = groupBySubjectPredicate(remote);
  const merged = new Map<string, RdfTriple>();
  const keys = new Set([...localByKey.keys(), ...remoteByKey.keys()]);

  for (const key of keys) {
    const localTriples = localByKey.get(key) ?? [];
    const remoteTriples = remoteByKey.get(key) ?? [];

    if (localTriples.length === 0) {
      for (const triple of remoteTriples) {
        merged.set(rdfTripleKey(triple), triple);
      }
      continue;
    }

    if (remoteTriples.length === 0) {
      for (const triple of localTriples) {
        merged.set(rdfTripleKey(triple), triple);
      }
      continue;
    }

    const all = [...localTriples, ...remoteTriples];
    const unique = new Map(all.map((triple) => [rdfTripleKey(triple), triple]));

    if (
      unique.size === 1 &&
      localTriples.length === 1 &&
      remoteTriples.length === 1
    ) {
      merged.set(rdfTripleKey(localTriples[0]!), localTriples[0]!);
      continue;
    }

    if (localTriples.length !== 1 || remoteTriples.length !== 1) {
      return {
        ok: false,
        reason: "Unsupported multi-value conflict for subject/predicate.",
      };
    }

    const localObject = localTriples[0]![2];
    const remoteObject = remoteTriples[0]![2];

    if (
      localObject.termType === "BlankNode" ||
      remoteObject.termType === "BlankNode"
    ) {
      return {
        ok: false,
        reason: "Unsupported blank-node object conflict.",
      };
    }

    const localKey = rdfTermToN3(localObject);
    const remoteKey = rdfTermToN3(remoteObject);
    const winner =
      remoteKey.localeCompare(localKey) >= 0
        ? remoteTriples[0]!
        : localTriples[0]!;
    merged.set(rdfTripleKey(winner), winner);
  }

  return {
    ok: true,
    graph: rdfTriplesToPublicTriples(Array.from(merged.values())),
  };
}

function groupBySubjectPredicate(
  triples: RdfTriple[],
): Map<string, RdfTriple[]> {
  const grouped = new Map<string, RdfTriple[]>();

  for (const triple of triples) {
    if (!isNamedNodeTerm(triple[0])) {
      continue;
    }
    const key = `${triple[0].value} ${triple[1].value}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(triple);
    } else {
      grouped.set(key, [triple]);
    }
  }

  return grouped;
}
