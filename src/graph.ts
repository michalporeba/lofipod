import type {
  EntityDefinition,
  ProjectionHelpers,
  StoredEntityRecord,
  ToRdfHelpers,
  Triple,
} from "./types.js";

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

function tripleKey([subject, predicate, object]: Triple): string {
  return JSON.stringify([subject, predicate, object]);
}

export function diffTriples(previous: Triple[], next: Triple[]) {
  const previousKeys = new Set(previous.map(tripleKey));
  const nextKeys = new Set(next.map(tripleKey));

  return {
    assertions: next.filter((triple) => !previousKeys.has(tripleKey(triple))),
    retractions: previous.filter((triple) => !nextKeys.has(tripleKey(triple))),
  };
}
