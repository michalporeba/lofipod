import type { NamedNode } from "n3";
import type { RdfTerm, Term, Triple } from "./rdf.js";

export type { RdfTerm, Term, Triple };

export type SyncMetadata = {
  observedRemoteChangeIds: string[];
};

export type ToRdfHelpers<T> = {
  uri(entity: T): NamedNode;
  child(path: string): NamedNode;
};

export type ProjectionHelpers = {
  uri(): NamedNode;
  child(path: string): NamedNode;
};

export type EntityDefinition<T> = {
  name: string;
  pod: {
    basePath: string;
  };
  rdfType: NamedNode;
  id(entity: T): string;
  uri?(entity: T): NamedNode;
  toRdf(entity: T, helpers: ToRdfHelpers<T>): Triple[];
  project(graph: Triple[], helpers: ProjectionHelpers): T;
};

export type LocalChange = {
  entityName: string;
  entityId: string;
  changeId: string;
  parentChangeId: string | null;
  timestamp: string;
  assertions: Triple[];
  retractions: Triple[];
  entityProjected: boolean;
  logProjected: boolean;
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
  removeEntity(entityName: string, entityId: string): void;
  writeEntity(
    entityName: string,
    entityId: string,
    record: StoredEntityRecord<unknown>,
  ): void;
  appendChange(change: LocalChange): void;
  markChangeEntityProjected(changeId: string): void;
  markChangeLogProjected(changeId: string): void;
  readSyncMetadata(): SyncMetadata;
  writeSyncMetadata(metadata: SyncMetadata): void;
  nextUpdatedOrder(): number;
};

export type PodEntityPatchRequest = {
  entityName: string;
  entityId: string;
  path: string;
  rootUri: string;
  changeId: string;
  parentChangeId: string | null;
  patch: string;
  assertions: Triple[];
  retractions: Triple[];
};

export type PodLogAppendRequest = {
  entityName: string;
  entityId: string;
  changeId: string;
  parentChangeId: string | null;
  timestamp: string;
  path: string;
  rootUri: string;
  assertions: Triple[];
  retractions: Triple[];
};

export type PodSyncAdapter = {
  applyEntityPatch(request: PodEntityPatchRequest): Promise<void>;
  deleteEntityResource?(request: {
    entityName: string;
    entityId: string;
    path: string;
  }): Promise<void>;
  appendLogEntry(request: PodLogAppendRequest): Promise<void>;
  listLogEntries?(): Promise<PodLogAppendRequest[]>;
  listCanonicalEntities?(input: {
    entityName: string;
    basePath: string;
    rdfType: NamedNode;
  }): Promise<
    {
      entityId: string;
      path: string;
      rootUri: string;
      graph: Triple[];
    }[]
  >;
};

export type LocalStorageAdapter = {
  readEntity(
    entityName: string,
    entityId: string,
  ): Promise<StoredEntityRecord<unknown> | null>;
  listEntities(entityName: string): Promise<ListedEntityRecord[]>;
  listChanges(entityName?: string, entityId?: string): Promise<LocalChange[]>;
  listPendingChanges?(): Promise<LocalChange[]>;
  readSyncMetadata(): Promise<SyncMetadata>;
  transact<T>(
    work: (transaction: LocalStorageTransaction) => Promise<T> | T,
  ): Promise<T>;
};

export type EngineConfig = {
  entities: EntityDefinition<unknown>[];
  storage?: LocalStorageAdapter;
  pod?: {
    logBasePath?: string;
  };
  sync?: {
    adapter: PodSyncAdapter;
  };
};

export type SyncState = {
  status: "unconfigured" | "idle" | "pending";
  configured: boolean;
  pendingChanges: number;
};

export type BootstrapCollision = {
  entityName: string;
  entityId: string;
  path: string;
};

export type BootstrapResult = {
  imported: number;
  skipped: number;
  collisions: BootstrapCollision[];
};

export type Engine = {
  save<T>(entityName: string, entity: T): Promise<T>;
  get<T>(entityName: string, id: string): Promise<T | null>;
  list<T>(entityName: string, options?: { limit?: number }): Promise<T[]>;
  delete(entityName: string, id: string): Promise<void>;
  sync: {
    state(): Promise<SyncState>;
    now(): Promise<void>;
    bootstrap(): Promise<BootstrapResult>;
  };
};
