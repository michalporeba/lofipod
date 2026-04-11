import { detectForks, type Fork } from "../change-log.js";
import {
  applyTripleDelta,
  createProjectionHelpers,
  diffTriples,
  graphsMatch,
} from "../graph.js";
import {
  publicTriplesToRdfTriples,
  rdfTermToN3,
  rdfTriplesToPublicTriples,
  type RdfTriple,
} from "../rdf.js";
import type { EntityDefinition, LocalChange } from "../types.js";
import type { EngineStorage } from "./support.js";
import {
  createChangeId,
  createTimestamp,
  fallbackEntityRootUri,
  inferRootUri,
} from "./support.js";

type BranchSnapshot = {
  change: LocalChange;
  graph: RdfTriple[];
  touchedKeys: Set<string>;
};

type EntityFork = Fork & {
  definition: EntityDefinition<unknown>;
};

export async function reconcileForksAfterPull(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  entityKeys: Iterable<string>,
): Promise<void> {
  const uniqueEntityKeys = Array.from(new Set(entityKeys));

  for (const entityKey of uniqueEntityKeys) {
    const [entityName, entityId] = splitEntityKey(entityKey);
    const definition = entities.get(entityName);

    if (!definition) {
      continue;
    }

    const changes = await storage.listChanges(entityName, entityId);
    const forks = detectForks(changes)
      .filter(
        (fork) => fork.entityName === entityName && fork.entityId === entityId,
      )
      .map((fork) => ({
        ...fork,
        definition,
      }));

    if (forks.length === 0) {
      continue;
    }

    await reconcileEntityForks(storage, definition, entityId, changes, forks);
  }
}

async function reconcileEntityForks(
  storage: EngineStorage,
  definition: EntityDefinition<unknown>,
  entityId: string,
  changes: LocalChange[],
  forks: EntityFork[],
): Promise<void> {
  const changesById = new Map(
    changes.map((change) => [change.changeId, change]),
  );
  const childrenByParent = buildChildrenByParent(changes);
  const snapshots = new Map<string, RdfTriple[]>();

  const getSnapshot = (changeId: string | null): RdfTriple[] => {
    if (!changeId) {
      return [];
    }

    const cached = snapshots.get(changeId);

    if (cached) {
      return cached;
    }

    const change = changesById.get(changeId);

    if (!change) {
      return [];
    }

    const nextGraph = applyTripleDelta(getSnapshot(change.parentChangeId), {
      assertions: publicTriplesToRdfTriples(change.assertions, {
        rdfType: definition.rdfType,
      }),
      retractions: publicTriplesToRdfTriples(change.retractions, {
        rdfType: definition.rdfType,
      }),
    });

    snapshots.set(changeId, nextGraph);
    return nextGraph;
  };

  let currentRecord = await storage.readEntity(definition.kind, entityId);

  for (const fork of forks) {
    const ancestorGraph = getSnapshot(fork.parentChangeId);
    const branchSnapshots = collectBranchSnapshots(
      fork,
      childrenByParent,
      getSnapshot,
      ancestorGraph,
    );

    if (branchSnapshots.length < 2) {
      continue;
    }

    const mergedGraph = mergeBranchSnapshots(ancestorGraph, branchSnapshots);
    const mergedPublicGraph = rdfTriplesToPublicTriples(mergedGraph);
    const currentPublicGraph = currentRecord?.graph ?? [];

    if (graphsMatch(currentPublicGraph, mergedPublicGraph)) {
      continue;
    }

    const currentInternalGraph = publicTriplesToRdfTriples(currentPublicGraph, {
      rdfType: definition.rdfType,
    });
    const { assertions, retractions } = diffTriples(
      currentInternalGraph,
      mergedGraph,
    );
    const rootUri = inferRootUri(
      definition,
      entityId,
      mergedPublicGraph,
      currentRecord?.rootUri ?? fallbackEntityRootUri(definition, entityId),
    );
    const projection = definition.project(
      mergedPublicGraph,
      createProjectionHelpers(rootUri),
    );
    const parentTip = selectWinningBranch(branchSnapshots);
    const changeId = createChangeId();
    const timestamp = createTimestamp();

    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.kind, entityId);
      const latestGraph = latest?.graph ?? [];

      if (graphsMatch(latestGraph, mergedPublicGraph)) {
        return;
      }

      if (mergedPublicGraph.length === 0) {
        transaction.removeEntity(definition.kind, entityId);
      } else {
        const updatedOrder = transaction.nextUpdatedOrder();

        transaction.writeEntity(definition.kind, entityId, {
          rootUri,
          graph: mergedPublicGraph,
          projection,
          lastChangeId: changeId,
          updatedOrder,
        });
      }

      transaction.appendChange({
        entityName: definition.kind,
        entityId,
        changeId,
        parentChangeId: parentTip.change.changeId,
        timestamp,
        assertions: rdfTriplesToPublicTriples(assertions),
        retractions: rdfTriplesToPublicTriples(retractions),
        entityProjected: false,
        logProjected: false,
      });
    });

    currentRecord = await storage.readEntity(definition.kind, entityId);
  }
}

function buildChildrenByParent(
  changes: LocalChange[],
): Map<string, LocalChange[]> {
  const childrenByParent = new Map<string, LocalChange[]>();

  for (const change of changes) {
    if (!change.parentChangeId) {
      continue;
    }

    const existing = childrenByParent.get(change.parentChangeId);

    if (existing) {
      existing.push(change);
    } else {
      childrenByParent.set(change.parentChangeId, [change]);
    }
  }

  return childrenByParent;
}

function collectBranchSnapshots(
  fork: EntityFork,
  childrenByParent: Map<string, LocalChange[]>,
  getSnapshot: (changeId: string | null) => RdfTriple[],
  ancestorGraph: RdfTriple[],
): BranchSnapshot[] {
  return fork.branches
    .flatMap((branch) =>
      collectLeafChanges(branch, childrenByParent).map((leaf) => {
        const graph = getSnapshot(leaf.changeId);
        const branchDiff = diffTriples(ancestorGraph, graph);

        return {
          change: leaf,
          graph,
          touchedKeys: new Set(
            [...branchDiff.assertions, ...branchDiff.retractions].map(
              tripleSubjectPredicateKey,
            ),
          ),
        };
      }),
    )
    .filter(
      (snapshot, index, snapshots) =>
        snapshots.findIndex(
          (candidate) => candidate.change.changeId === snapshot.change.changeId,
        ) === index,
    );
}

function collectLeafChanges(
  root: LocalChange,
  childrenByParent: Map<string, LocalChange[]>,
): LocalChange[] {
  const children = childrenByParent.get(root.changeId) ?? [];

  if (children.length === 0) {
    return [root];
  }

  return children.flatMap((child) =>
    collectLeafChanges(child, childrenByParent),
  );
}

function mergeBranchSnapshots(
  ancestorGraph: RdfTriple[],
  branches: BranchSnapshot[],
): RdfTriple[] {
  const ancestorByKey = groupBySubjectPredicate(ancestorGraph);
  const touchedKeys = new Set(
    branches.flatMap((branch) => Array.from(branch.touchedKeys)),
  );
  const mergedByKey = new Map<string, RdfTriple[]>(ancestorByKey);

  for (const key of touchedKeys) {
    const touchingBranches = branches.filter((branch) =>
      branch.touchedKeys.has(key),
    );

    if (touchingBranches.length === 0) {
      continue;
    }

    const winner =
      touchingBranches.length === 1
        ? touchingBranches[0]!
        : selectWinningBranch(touchingBranches);

    mergedByKey.set(key, groupBySubjectPredicate(winner.graph).get(key) ?? []);
  }

  return Array.from(mergedByKey.values()).flat();
}

function groupBySubjectPredicate(graph: RdfTriple[]): Map<string, RdfTriple[]> {
  const grouped = new Map<string, RdfTriple[]>();

  for (const triple of graph) {
    const key = tripleSubjectPredicateKey(triple);
    const existing = grouped.get(key);

    if (existing) {
      existing.push(triple);
    } else {
      grouped.set(key, [triple]);
    }
  }

  return grouped;
}

function tripleSubjectPredicateKey(triple: RdfTriple): string {
  return `${rdfTermToN3(triple[0])}|${rdfTermToN3(triple[1])}`;
}

function selectWinningBranch<T extends { change: LocalChange }>(
  branches: T[],
): T {
  return [...branches].sort(compareBranchPriorityDesc)[0]!;
}

function compareBranchPriorityDesc<T extends { change: LocalChange }>(
  left: T,
  right: T,
): number {
  if (left.change.timestamp !== right.change.timestamp) {
    return right.change.timestamp.localeCompare(left.change.timestamp);
  }

  return right.change.changeId.localeCompare(left.change.changeId);
}

function splitEntityKey(
  entityKey: string,
): [entityName: string, entityId: string] {
  const separator = entityKey.indexOf(":");

  if (separator === -1) {
    return [entityKey, ""];
  }

  return [entityKey.slice(0, separator), entityKey.slice(separator + 1)];
}
