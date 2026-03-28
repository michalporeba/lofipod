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

export type EngineConfig = {
  entities: EntityDefinition<unknown>[];
};

export type Engine = {
  save<T>(entityName: string, entity: T): Promise<T>;
  get<T>(entityName: string, id: string): Promise<T | null>;
};

function createRootUri(entityName: string, id: string): string {
  return `lofipod://entity/${entityName}/${id}`;
}

function createChildUri(rootUri: string, path: string): string {
  return `${rootUri}#${path}`;
}

export function createEngine(config: EngineConfig): Engine {
  const entities = new Map(
    config.entities.map((entity) => [entity.name, entity]),
  );
  const graphs = new Map<string, Triple[]>();

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
      const graph = definition.toRdf(entity, {
        uri() {
          return rootUri;
        },
        child(path) {
          return createChildUri(rootUri, path);
        },
      });

      graphs.set(`${definition.name}:${id}`, graph);

      return entity;
    },

    async get<T>(entityName: string, id: string): Promise<T | null> {
      const definition = requireEntity(entityName) as EntityDefinition<T>;
      const graph = graphs.get(`${definition.name}:${id}`);

      if (!graph) {
        return null;
      }

      const rootUri = createRootUri(definition.name, id);

      return definition.project(graph, {
        uri() {
          return rootUri;
        },
        child(path) {
          return createChildUri(rootUri, path);
        },
      });
    },
  };
}
