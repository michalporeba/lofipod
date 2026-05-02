import type { NamedNode } from "n3";
import type { RdfTerm, Term, Triple } from "./rdf.js";

export type { RdfTerm, Term, Triple };

export type PersistedPodConfig = {
  podBaseUrl: string;
  logBasePath: string;
};

export type Logger = {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

export type SyncMetadata = {
  observedRemoteChangeIds: string[];
  persistedPodConfig: PersistedPodConfig | null;
  canonicalContainerVersions: Record<string, string>;
  connection: {
    reachable: boolean;
    lastSyncedAt: string | null;
    lastFailedAt: string | null;
    lastFailureReason: string | null;
  };
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
  kind: string;
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
  setLogger?(logger: Logger | undefined): void;
  applyEntityPatch(request: PodEntityPatchRequest): Promise<void>;
  deleteEntityResource?(request: {
    entityName: string;
    entityId: string;
    path: string;
  }): Promise<void>;
  appendLogEntry(request: PodLogAppendRequest): Promise<void>;
  listLogEntries?(input?: {
    logBasePath: string;
  }): Promise<PodLogAppendRequest[]>;
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
  checkCanonicalResources?(input: {
    entityName: string;
    basePath: string;
    rdfType: NamedNode;
    previousVersion: string | null;
  }): Promise<{
    version: string | null;
    changed: boolean;
    entities: {
      entityId: string;
      path: string;
      rootUri: string;
      graph: Triple[];
    }[];
  }>;
  subscribeToContainer?(
    containerPath: string,
    onNotification: () => void,
  ): Promise<{
    unsubscribe: () => Promise<void> | void;
  }>;
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
  logger?: Logger;
  pod?: {
    logBasePath?: string;
    podBaseUrl?: string;
  };
  sync?: {
    adapter: PodSyncAdapter;
    pollIntervalMs?: number;
  };
};

export type SyncAttachConfig = {
  adapter: PodSyncAdapter;
  podBaseUrl: string;
  logBasePath: string;
  pollIntervalMs?: number;
  startBackground?: boolean;
};

export type SyncState = {
  status: "unconfigured" | "offline" | "syncing" | "idle" | "pending";
  configured: boolean;
  pendingChanges: number;
  connection: {
    reachable: boolean;
    lastSyncedAt: string | null;
    lastFailedAt: string | null;
    lastFailureReason: string | null;
    notificationsActive: boolean;
  };
};

export type BootstrapCollision = {
  entityName: string;
  entityId: string;
  path: string;
};

export type BootstrapReconciliation = {
  entityName: string;
  entityId: string;
  path: string;
  resolution: "merged";
};

export type BootstrapUnsupported = {
  entityName: string;
  entityId: string;
  path: string;
  reason: string;
};

export type BootstrapResult = {
  imported: number;
  skipped: number;
  reconciled: BootstrapReconciliation[];
  unsupported: BootstrapUnsupported[];
  collisions: BootstrapCollision[];
};

export type Engine = {
  save<T>(entityKind: string, entity: T): Promise<T>;
  get<T>(entityKind: string, id: string): Promise<T | null>;
  list<T>(entityKind: string, options?: { limit?: number }): Promise<T[]>;
  delete(entityKind: string, id: string): Promise<void>;
  dispose(): Promise<void>;
  sync: {
    attach(config: SyncAttachConfig): Promise<void>;
    detach(): Promise<void>;
    persistedConfig(): Promise<PersistedPodConfig | null>;
    state(): Promise<SyncState>;
    onStateChange(callback: (state: SyncState) => void): () => void;
    now(): Promise<void>;
    bootstrap(): Promise<BootstrapResult>;
  };
};
