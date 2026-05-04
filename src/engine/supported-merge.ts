import {
  isNamedNodeTerm,
  publicTriplesToRdfTriples,
  rdfTermToN3,
  rdfTripleKey,
  rdfTriplesToPublicTriples,
  type RdfTriple,
} from "../rdf.js";
import type { EntityDefinition, Triple } from "../types.js";

export function mergeSupportedGraphs(
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

  if (!allSubjectsAreNamedNodes(local) || !allSubjectsAreNamedNodes(remote)) {
    return {
      ok: false,
      reason: "Unsupported non-IRI subject in canonical graph.",
    };
  }

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

function groupBySubjectPredicate(graph: RdfTriple[]): Map<string, RdfTriple[]> {
  const grouped = new Map<string, RdfTriple[]>();

  for (const triple of graph) {
    if (!isNamedNodeTerm(triple[0])) {
      continue;
    }

    const key = `${rdfTermToN3(triple[0])} ${rdfTermToN3(triple[1])}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.push(triple);
    } else {
      grouped.set(key, [triple]);
    }
  }

  return grouped;
}

function allSubjectsAreNamedNodes(graph: RdfTriple[]): boolean {
  return graph.every((triple) => isNamedNodeTerm(triple[0]));
}
