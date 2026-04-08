import type {
  EntityDefinition,
  ProjectionHelpers,
  StoredEntityRecord,
  ToRdfHelpers,
  Triple,
} from "./types.js";
import type { RdfTriple } from "./rdf.js";
import { publicTriplesToRdfTriples, rdfTripleKey } from "./rdf.js";

export function fallbackRootUri(entityName: string, id: string): string {
  return `lofipod://entity/${entityName}/${id}`;
}

export function createChildUri(rootUri: string, path: string): string {
  return `${rootUri}#${path}`;
}

export function createToRdfHelpers<T>(rootUri: string): ToRdfHelpers<T> {
  return {
    uri() {
      return rootUri;
    },
    child(path) {
      return createChildUri(rootUri, path);
    },
  };
}

export function createProjectionHelpers(rootUri: string): ProjectionHelpers {
  return {
    uri() {
      return rootUri;
    },
    child(path) {
      return createChildUri(rootUri, path);
    },
  };
}

export function createStoredRecord<T>(
  definition: EntityDefinition<T>,
  entity: T,
  graph: Triple[],
  changeId: string,
  updatedOrder: number,
): StoredEntityRecord<T> {
  const rootUri =
    definition.uri?.(entity) ??
    fallbackRootUri(definition.name, definition.id(entity));
  const projection = definition.project(
    graph,
    createProjectionHelpers(rootUri),
  );

  return {
    rootUri,
    graph,
    projection,
    lastChangeId: changeId,
    updatedOrder,
  };
}

export function projectStoredRecord<T>(
  definition: EntityDefinition<T>,
  record: StoredEntityRecord<unknown>,
): T {
  return definition.project(
    record.graph,
    createProjectionHelpers(record.rootUri),
  );
}

export function projectionsMatch(current: unknown, next: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}

export function graphsMatch(current: Triple[], next: Triple[]): boolean {
  const diff = diffTriples(
    publicTriplesToRdfTriples(current),
    publicTriplesToRdfTriples(next),
  );
  return diff.assertions.length === 0 && diff.retractions.length === 0;
}

export function diffTriples(previous: RdfTriple[], next: RdfTriple[]) {
  const previousKeys = new Set(previous.map(rdfTripleKey));
  const nextKeys = new Set(next.map(rdfTripleKey));

  return {
    assertions: next.filter((triple) => !previousKeys.has(rdfTripleKey(triple))),
    retractions: previous.filter((triple) => !nextKeys.has(rdfTripleKey(triple))),
  };
}

export function applyTripleDelta(
  current: RdfTriple[],
  input: {
    assertions: RdfTriple[];
    retractions: RdfTriple[];
  },
): RdfTriple[] {
  const next = new Map(current.map((triple) => [rdfTripleKey(triple), triple]));

  for (const triple of input.retractions) {
    next.delete(rdfTripleKey(triple));
  }

  for (const triple of input.assertions) {
    next.set(rdfTripleKey(triple), triple);
  }

  return Array.from(next.values());
}
