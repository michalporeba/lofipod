export const packageVersion = "0.1.0";

export { defineEntity } from "./entity.js";
export { createEngine } from "./engine.js";
export { createMemoryStorage } from "./storage/memory.js";
export { defineVocabulary, rdf } from "./vocabulary.js";
export type {
  Engine,
  EngineConfig,
  EntityDefinition,
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  ProjectionHelpers,
  StoredEntityRecord,
  Term,
  ToRdfHelpers,
  Triple,
} from "./types.js";
