export const packageVersion = "0.1.0";

export const rdf = {
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
} as const;

export type Term = string | number | boolean;

export type Triple = [subject: Term, predicate: Term, object: Term];

export type VocabularyUriFactoryInput = {
  base: string;
  entityName: string;
  id: string;
};

export type VocabularyDefinition<TTerms extends Record<string, string>> = {
  base: string;
  terms: TTerms;
  uri(input: VocabularyUriFactoryInput): string;
};

export type Vocabulary<TTerms extends Record<string, string>> = {
  [K in keyof TTerms]: string;
} & {
  uri(input: Omit<VocabularyUriFactoryInput, "base">): string;
};

export function defineVocabulary<TTerms extends Record<string, string>>(
  definition: VocabularyDefinition<TTerms>,
): Vocabulary<TTerms> {
  const terms = Object.fromEntries(
    Object.entries(definition.terms).map(([key, value]) => [
      key,
      `${definition.base}${value}`,
    ]),
  ) as Record<keyof TTerms, string>;

  return {
    ...terms,
    uri(input) {
      return definition.uri({
        base: definition.base,
        ...input,
      });
    },
  };
}

export type ToRdfHelpers<T> = {
  uri(entity: T): string;
  child(path: string): string;
};

export type ProjectionHelpers = {
  uri(): string;
  child(path: string): string;
};

export type EntityDefinition<T> = {
  name: string;
  pod: {
    basePath: string;
  };
  rdfType: string;
  id(entity: T): string;
  toRdf(entity: T, helpers: ToRdfHelpers<T>): Triple[];
  project(graph: Triple[], helpers: ProjectionHelpers): T;
};

export function defineEntity<T>(
  definition: EntityDefinition<T>,
): EntityDefinition<T> {
  return definition;
}

export type LocalChange = {
  entityName: string;
  entityId: string;
  changeId: string;
  parentChangeId: string | null;
  assertions: Triple[];
  retractions: Triple[];
};

export type StoredEntityRecord<T = unknown> = {
  graph: Triple[];
  projection: T;
  lastChangeId: string | null;
  updatedOrder: number;
};

export type LocalStorageTransaction = {
  readEntity(
    entityName: string,
    entityId: string,
  ): StoredEntityRecord<unknown> | null;
  writeEntity(
    entityName: string,
    entityId: string,
    record: StoredEntityRecord<unknown>,
  ): void;
  appendChange(change: LocalChange): void;
};

export type LocalStorageAdapter = {
  readEntity(
    entityName: string,
    entityId: string,
  ): Promise<StoredEntityRecord<unknown> | null>;
  listEntities(
    entityName: string,
  ): Promise<Array<{ entityId: string; record: StoredEntityRecord<unknown> }>>;
  listChanges(entityName?: string, entityId?: string): Promise<LocalChange[]>;
  transact<T>(
    work: (transaction: LocalStorageTransaction) => Promise<T> | T,
  ): Promise<T>;
};

export type EngineConfig = {
  entities: EntityDefinition<unknown>[];
  storage?: LocalStorageAdapter;
};

export type Engine = {
  save<T>(entityName: string, entity: T): Promise<T>;
  get<T>(entityName: string, id: string): Promise<T | null>;
  list<T>(entityName: string, options?: { limit?: number }): Promise<T[]>;
};

function createRootUri(entityName: string, id: string): string {
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

export function createMemoryStorage(): LocalStorageAdapter {
  const state = {
    records: new Map<string, StoredEntityRecord<unknown>>(),
    changes: [] as LocalChange[],
  };

  const cloneRecord = (
    record: StoredEntityRecord<unknown>,
  ): StoredEntityRecord<unknown> => ({
    graph: [...record.graph],
    projection: record.projection,
    lastChangeId: record.lastChangeId,
    updatedOrder: record.updatedOrder,
  });

  return {
    async readEntity(entityName, entityId) {
      const record = state.records.get(`${entityName}:${entityId}`);

      return record ? cloneRecord(record) : null;
    },

    async listChanges(entityName, entityId) {
      return state.changes
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map((change) => ({
          ...change,
          assertions: [...change.assertions],
          retractions: [...change.retractions],
        }));
    },

    async listEntities(entityName) {
      return Array.from(state.records.entries())
        .filter(([key]) => key.startsWith(`${entityName}:`))
        .map(([key, record]) => ({
          entityId: key.slice(entityName.length + 1),
          record: cloneRecord(record),
        }))
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const draft = {
        records: new Map(
          Array.from(state.records.entries(), ([key, value]) => [
            key,
            cloneRecord(value),
          ]),
        ),
        changes: state.changes.map((change) => ({
          ...change,
          assertions: [...change.assertions],
          retractions: [...change.retractions],
        })),
      };

      const transaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          return draft.records.get(`${entityName}:${entityId}`) ?? null;
        },
        writeEntity(entityName, entityId, record) {
          draft.records.set(`${entityName}:${entityId}`, cloneRecord(record));
        },
        appendChange(change) {
          draft.changes.push({
            ...change,
            assertions: [...change.assertions],
            retractions: [...change.retractions],
          });
        },
      };

      const result = await work(transaction);

      state.records = draft.records;
      state.changes = draft.changes;

      return result;
    },
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
      const id = definition.id(entity);
      const rootUri = createRootUri(definition.name, id);
      const previousRecord = await storage.readEntity(definition.name, id);
      const graph = definition.toRdf(entity, {
        uri() {
          return rootUri;
        },
        child(path) {
          return createChildUri(rootUri, path);
        },
      });
      const projection = definition.project(graph, {
        uri() {
          return rootUri;
        },
        child(path) {
          return createChildUri(rootUri, path);
        },
      });
      const { assertions, retractions } = diffTriples(
        previousRecord?.graph ?? [],
        graph,
      );

      if (assertions.length === 0 && retractions.length === 0) {
        return entity;
      }

      const changeId = createChangeId(definition.name, id);
      const updatedOrder = (await storage.listChanges()).length + 1;

      await storage.transact((transaction) => {
        transaction.writeEntity(definition.name, id, {
          graph,
          projection,
          lastChangeId: changeId,
          updatedOrder,
        });
        transaction.appendChange({
          entityName: definition.name,
          entityId: id,
          changeId,
          parentChangeId: previousRecord?.lastChangeId ?? null,
          assertions,
          retractions,
        });
      });

      return entity;
    },

    async get<T>(entityName: string, id: string): Promise<T | null> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const record = await storage.readEntity(definition.name, id);

      if (!record) {
        return null;
      }

      return record.projection as T;
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

      return limited.map(({ record }) => record.projection as T);
    },
  };
}
