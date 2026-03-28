import { createMemoryStorage } from "./storage/memory.js";
import type {
  Engine,
  EngineConfig,
  EntityDefinition,
  ProjectionHelpers,
  StoredEntityRecord,
  ToRdfHelpers,
  Triple,
} from "./types.js";

function fallbackRootUri(entityName: string, id: string): string {
  return `lofipod://entity/${entityName}/${id}`;
}

function createChildUri(rootUri: string, path: string): string {
  return `${rootUri}#${path}`;
}

function createChangeId(entityName: string, id: string): string {
  return `${entityName}:${id}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function tripleKey([subject, predicate, object]: Triple): string {
  return JSON.stringify([subject, predicate, object]);
}

function diffTriples(previous: Triple[], next: Triple[]) {
  const previousKeys = new Set(previous.map(tripleKey));
  const nextKeys = new Set(next.map(tripleKey));

  return {
    assertions: next.filter((triple) => !previousKeys.has(tripleKey(triple))),
    retractions: previous.filter((triple) => !nextKeys.has(tripleKey(triple))),
  };
}

function createToRdfHelpers<T>(
  entity: T,
  definition: EntityDefinition<T>,
  rootUri: string,
): ToRdfHelpers<T> {
  return {
    uri() {
      return rootUri;
    },
    child(path) {
      return createChildUri(rootUri, path);
    },
  };
}

function createProjectionHelpers(rootUri: string): ProjectionHelpers {
  return {
    uri() {
      return rootUri;
    },
    child(path) {
      return createChildUri(rootUri, path);
    },
  };
}

function createStoredRecord<T>(
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

function projectStoredRecord<T>(
  definition: EntityDefinition<T>,
  record: StoredEntityRecord<unknown>,
): T {
  return definition.project(
    record.graph,
    createProjectionHelpers(record.rootUri),
  );
}

function projectionsMatch(current: unknown, next: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}

export function createEngine(config: EngineConfig): Engine {
  const entities = new Map(
    config.entities.map((entity) => [entity.name, entity]),
  );
  const storage = config.storage ?? createMemoryStorage();

  const requireEntity = (entityName: string): EntityDefinition<unknown> => {
    const entity = entities.get(entityName);

    if (!entity) {
      throw new Error(`Unknown entity type: ${entityName}`);
    }

    return entity;
  };

  return {
    async save<T>(entityName: string, entity: T): Promise<T> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const entityId = definition.id(entity);
      const rootUri =
        definition.uri?.(entity) ?? fallbackRootUri(definition.name, entityId);
      const previousRecord = await storage.readEntity(
        definition.name,
        entityId,
      );
      const graph = definition.toRdf(
        entity,
        createToRdfHelpers(entity, definition, rootUri),
      );
      const { assertions, retractions } = diffTriples(
        previousRecord?.graph ?? [],
        graph,
      );

      if (assertions.length === 0 && retractions.length === 0) {
        return (previousRecord?.projection as T) ?? entity;
      }

      const changeId = createChangeId(definition.name, entityId);

      const storedRecord = await storage.transact((transaction) => {
        const updatedOrder = transaction.nextUpdatedOrder();
        const nextRecord = createStoredRecord(
          definition,
          entity,
          graph,
          changeId,
          updatedOrder,
        );

        transaction.writeEntity(definition.name, entityId, nextRecord);
        transaction.appendChange({
          entityName: definition.name,
          entityId,
          changeId,
          parentChangeId: previousRecord?.lastChangeId ?? null,
          assertions,
          retractions,
        });

        return nextRecord;
      });

      return storedRecord.projection as T;
    },

    async get<T>(entityName: string, id: string): Promise<T | null> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const record = await storage.readEntity(definition.name, id);

      if (!record) {
        return null;
      }

      const projected = projectStoredRecord(definition, record);

      if (!projectionsMatch(record.projection, projected)) {
        await storage.transact((transaction) => {
          const latest = transaction.readEntity(definition.name, id);

          if (!latest) {
            return;
          }

          transaction.writeEntity(definition.name, id, {
            ...latest,
            projection: projected,
          });
        });
      }

      return projected;
    },

    async list<T>(
      entityName: string,
      options?: { limit?: number },
    ): Promise<T[]> {
      requireEntity(entityName);

      const records = await storage.listEntities(entityName);
      const limited =
        typeof options?.limit === "number"
          ? records.slice(0, options.limit)
          : records;

      const projected = await Promise.all(
        limited.map(async ({ entityId, record }) => {
          const value = projectStoredRecord(
            requireEntity(entityName) as EntityDefinition<T>,
            record,
          );

          if (!projectionsMatch(record.projection, value)) {
            await storage.transact((transaction) => {
              const latest = transaction.readEntity(entityName, entityId);

              if (!latest) {
                return;
              }

              transaction.writeEntity(entityName, entityId, {
                ...latest,
                projection: value,
              });
            });
          }

          return value;
        }),
      );

      return projected;
    },
  };
}
