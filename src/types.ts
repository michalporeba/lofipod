export type Term = string | number | boolean;

export type Triple = [subject: Term, predicate: Term, object: Term];

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
  uri?(entity: T): string;
  toRdf(entity: T, helpers: ToRdfHelpers<T>): Triple[];
  project(graph: Triple[], helpers: ProjectionHelpers): T;
};

export type LocalChange = {
  entityName: string;
  entityId: string;
  changeId: string;
  parentChangeId: string | null;
  assertions: Triple[];
  retractions: Triple[];
};

export type StoredEntityRecord<T = unknown> = {
  rootUri: string;
  graph: Triple[];
  projection: T;
  lastChangeId: string | null;
  updatedOrder: number;
};

export type ListedEntityRecord = {
  entityId: string;
  record: StoredEntityRecord<unknown>;
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
  nextUpdatedOrder(): number;
};

export type LocalStorageAdapter = {
  readEntity(
    entityName: string,
    entityId: string,
  ): Promise<StoredEntityRecord<unknown> | null>;
  listEntities(entityName: string): Promise<ListedEntityRecord[]>;
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
