import type { EngineConfig, EntityDefinition } from "../types.js";
import { logDebug, nowMs, durationSince } from "../logger.js";
import type { EngineStorage } from "./support.js";
import { reconcileCanonicalResources } from "./remote-canonical.js";
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

  const logger = config.logger;
  const cycleStartedAt = logger ? nowMs() : 0;

  const pushStartedAt = logger ? nowMs() : 0;
  const changesPushed = await syncPendingChanges(storage, entities, config);
  if (logger) {
    logDebug(logger, "sync:push", {
      durationMs: durationSince(pushStartedAt),
      changesPushed,
    });
  }

  const pullStartedAt = logger ? nowMs() : 0;
  const entriesReplayed = await replayRemoteLogEntries(
    storage,
    entities,
    config,
  );
  if (logger) {
    logDebug(logger, "sync:pull", {
      durationMs: durationSince(pullStartedAt),
      entriesReplayed,
    });
  }

  const reconcileStartedAt = logger ? nowMs() : 0;
  const entitiesReconciled = await reconcileCanonicalResources(
    storage,
    entities,
    config,
  );
  if (logger) {
    logDebug(logger, "sync:reconcile", {
      durationMs: durationSince(reconcileStartedAt),
      entitiesReconciled,
    });

    logDebug(logger, "sync:cycle", {
      durationMs: durationSince(cycleStartedAt),
    });
  }
}
