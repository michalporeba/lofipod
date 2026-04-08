import type { EngineConfig, EntityDefinition } from "../types.js";
import type { EngineStorage } from "./support.js";
import { replayRemoteLogEntries } from "./remote-pull.js";
import { syncPendingChanges } from "./remote-push.js";

export { bootstrapFromCanonicalResources } from "./remote-bootstrap.js";

export async function syncNow(
  storage: EngineStorage,
  entities: Map<string, EntityDefinition<unknown>>,
  config: EngineConfig,
): Promise<void> {
  if (!config.sync) {
    return;
  }

  await syncPendingChanges(storage, entities, config);
  await replayRemoteLogEntries(storage, entities, config);
}
