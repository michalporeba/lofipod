export const packageVersion = "0.1.0";

export { defineEntity } from "./entity.js";
export { createEngine } from "./engine.js";
export { createSolidPodAdapter } from "./pod/solid.js";
export { createIndexedDbStorage } from "./storage/indexeddb.js";
export { createMemoryStorage } from "./storage/memory.js";
export { createSqliteStorage } from "./storage/sqlite.js";
export { defineVocabulary, rdf } from "./vocabulary.js";
export type {
  BootstrapCollision,
  BootstrapResult,
  Engine,
  EngineConfig,
  EntityDefinition,
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  PodEntityPatchRequest,
  PodSyncAdapter,
  ProjectionHelpers,
  StoredEntityRecord,
  SyncState,
  SyncMetadata,
  Term,
  ToRdfHelpers,
  Triple,
} from "./types.js";
