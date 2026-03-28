import { createMemoryStorage } from "./storage/memory.js";
import type {
  Engine,
  EngineConfig,
  EntityDefinition,
  LocalChange,
  PodEntityPatchRequest,
  ProjectionHelpers,
  StoredEntityRecord,
  SyncState,
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

async function readSyncState(
  storage: NonNullable<EngineConfig["storage"]>,
  syncConfig: EngineConfig["sync"],
): Promise<SyncState> {
  const pendingChanges = (await storage.listChanges()).filter(
    (change) => !change.entityProjected,
  ).length;

  if (!syncConfig) {
    return {
      status: "unconfigured",
      configured: false,
      pendingChanges,
    };
  }

  return {
    status: pendingChanges > 0 ? "pending" : "idle",
    configured: true,
    pendingChanges,
  };
}

async function repairStoredProjection<T>(
  storage: EngineConfig["storage"] extends infer _
    ? NonNullable<EngineConfig["storage"]>
    : never,
  definition: EntityDefinition<T>,
  entityId: string,
  record: StoredEntityRecord<unknown>,
): Promise<T> {
  const projected = projectStoredRecord(definition, record);

  if (!projectionsMatch(record.projection, projected)) {
    await storage.transact((transaction) => {
      const latest = transaction.readEntity(definition.name, entityId);

      if (!latest) {
        return;
      }

      transaction.writeEntity(definition.name, entityId, {
        ...latest,
        projection: projected,
      });
    });
  }

  return projected;
}

function termToN3(term: Triple[number]): string {
  if (typeof term === "number" || typeof term === "boolean") {
    return String(term);
  }

  if (
    term.startsWith("http://") ||
    term.startsWith("https://") ||
    term.startsWith("urn:") ||
    term.startsWith("lofipod://")
  ) {
    return `<${term}>`;
  }

  return JSON.stringify(term);
}

function triplesToN3(triples: Triple[]): string {
  return triples
    .map(
      ([subject, predicate, object]) =>
        `  ${termToN3(subject)} ${termToN3(predicate)} ${termToN3(object)} .`,
    )
    .join("\n");
}

function createEntityPatchRequest(
  definition: EntityDefinition<unknown>,
  record: StoredEntityRecord<unknown>,
  change: LocalChange,
): PodEntityPatchRequest {
  const path = `${definition.pod.basePath}${change.entityId}.ttl`;
  const sections: string[] = [];

  if (change.retractions.length > 0) {
    sections.push(`Delete {\n${triplesToN3(change.retractions)}\n}`);
  }

  if (change.assertions.length > 0) {
    sections.push(`Insert {\n${triplesToN3(change.assertions)}\n}`);
  }

  sections.push("Where {}");

  return {
    entityName: change.entityName,
    entityId: change.entityId,
    path,
    rootUri: record.rootUri,
    changeId: change.changeId,
    parentChangeId: change.parentChangeId,
    patch: sections.join("\n"),
  };
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
          entityProjected: false,
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

      return repairStoredProjection(storage, definition, id, record);
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
          return repairStoredProjection(
            storage,
            requireEntity(entityName) as EntityDefinition<T>,
            entityId,
            record,
          );
        }),
      );

      return projected;
    },

    sync: {
      async state(): Promise<SyncState> {
        return readSyncState(storage, config.sync);
      },

      async now(): Promise<void> {
        if (!config.sync) {
          return;
        }

        const pendingChanges = (await storage.listChanges()).filter(
          (change) => !change.entityProjected,
        );

        for (const change of pendingChanges) {
          const definition = requireEntity(change.entityName);
          const record = await storage.readEntity(
            change.entityName,
            change.entityId,
          );

          if (!record) {
            continue;
          }

          await config.sync.adapter.applyEntityPatch(
            createEntityPatchRequest(definition, record, change),
          );

          await storage.transact((transaction) => {
            transaction.markChangeEntityProjected(change.changeId);
          });
        }
      },
    },
  };
}
