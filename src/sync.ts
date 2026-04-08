import type {
  EngineConfig,
  EntityDefinition,
  LocalChange,
  PodEntityPatchRequest,
  PodLogAppendRequest,
  StoredEntityRecord,
  SyncState,
  Triple,
} from "./types.js";

export function hasPendingSync(change: LocalChange): boolean {
  return !change.entityProjected || !change.logProjected;
}

export async function readSyncState(
  storage: NonNullable<EngineConfig["storage"]>,
  syncConfig: EngineConfig["sync"],
): Promise<SyncState> {
  const pendingChanges = (
    storage.listPendingChanges
      ? await storage.listPendingChanges()
      : (await storage.listChanges()).filter(hasPendingSync)
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

const SOLID_TERMS = "http://www.w3.org/ns/solid/terms#";
const RDF_SYNTAX = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

export function createEntityPatchRequest(
  definition: EntityDefinition<unknown>,
  record: StoredEntityRecord<unknown>,
  change: LocalChange,
): PodEntityPatchRequest {
  const path = `${definition.pod.basePath}${change.entityId}.ttl`;
  const fields = [
    `@prefix solid: <${SOLID_TERMS}>.`,
    `@prefix rdf: <${RDF_SYNTAX}>.`,
    "",
    "_:patch",
    "  a solid:InsertDeletePatch;",
  ];

  if (change.assertions.length > 0) {
    fields.push(`  solid:inserts {\n${triplesToN3(change.assertions)}\n  };`);
  }

  if (change.retractions.length > 0) {
    fields.push(`  solid:deletes {\n${triplesToN3(change.retractions)}\n  };`);
  }

  if (change.retractions.length > 0) {
    fields.push(`  solid:where {\n${triplesToN3(change.retractions)}\n  }.`);
  } else {
    fields.push("  solid:where {}.");
  }

  return {
    entityName: change.entityName,
    entityId: change.entityId,
    path,
    rootUri: record.rootUri,
    changeId: change.changeId,
    parentChangeId: change.parentChangeId,
    patch: fields.join("\n"),
    assertions: change.assertions,
    retractions: change.retractions,
  };
}

export function normalizeLogBasePath(logBasePath: string): string {
  return logBasePath.endsWith("/") ? logBasePath : `${logBasePath}/`;
}

export function createLogAppendRequest(
  change: LocalChange,
  record: StoredEntityRecord<unknown>,
  logBasePath: string,
): PodLogAppendRequest {
  return {
    entityName: change.entityName,
    entityId: change.entityId,
    changeId: change.changeId,
    parentChangeId: change.parentChangeId,
    path: `${normalizeLogBasePath(logBasePath)}${change.entityName}/${change.changeId}.ttl`,
    rootUri: record.rootUri,
    assertions: change.assertions,
    retractions: change.retractions,
  };
}
