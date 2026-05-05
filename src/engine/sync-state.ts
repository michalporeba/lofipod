import type { EngineConfig, SyncState } from "../types.js";
import type { EngineStorage } from "./support.js";

export type RuntimeSyncState = {
  syncing: boolean;
  notificationsActive: boolean;
};

export function createRuntimeSyncState(): RuntimeSyncState {
  return {
    syncing: false,
    notificationsActive: false,
  };
}

export async function persistSyncSuccess(
  storage: EngineStorage,
  timestamp: string,
): Promise<void> {
  await storage.transact((transaction) => {
    const metadata = transaction.readSyncMetadata();

    transaction.writeSyncMetadata({
      ...metadata,
      connection: {
        reachable: true,
        lastSyncedAt: timestamp,
        lastFailedAt: null,
        lastFailureReason: null,
      },
    });
  });
}

export async function persistSyncFailure(
  storage: EngineStorage,
  timestamp: string,
  reason: string,
): Promise<void> {
  await storage.transact((transaction) => {
    const metadata = transaction.readSyncMetadata();

    transaction.writeSyncMetadata({
      ...metadata,
      connection: {
        ...metadata.connection,
        reachable: false,
        lastFailedAt: timestamp,
        lastFailureReason: reason,
      },
    });
  });
}

export async function readDerivedSyncState(
  storage: NonNullable<EngineConfig["storage"]>,
  syncConfig: EngineConfig["sync"],
  runtime: RuntimeSyncState,
): Promise<SyncState> {
  const metadata = await storage.readSyncMetadata();
  const pendingChanges = (
    storage.listPendingChanges
      ? await storage.listPendingChanges()
      : await storage.listChanges()
  ).filter((change) => !change.entityProjected || !change.logProjected).length;

  const connection = {
    reachable: syncConfig ? metadata.connection.reachable : false,
    lastSyncedAt: metadata.connection.lastSyncedAt,
    lastFailedAt: metadata.connection.lastFailedAt,
    lastFailureReason: metadata.connection.lastFailureReason,
    notificationsActive: syncConfig ? runtime.notificationsActive : false,
  };
  const reconciliation = {
    lastUnsupportedPolicy:
      metadata.reconciliation?.lastUnsupportedPolicy ?? null,
    lastUnsupportedReason:
      metadata.reconciliation?.lastUnsupportedReason ?? null,
  };
  const migration = {
    lastLocalOutcome: metadata.migration?.lastLocalOutcome ?? null,
    lastCanonicalRemoteOutcome:
      metadata.migration?.lastCanonicalRemoteOutcome ?? null,
  };

  if (!syncConfig) {
    return {
      status: "unconfigured",
      configured: false,
      pendingChanges,
      reconciliation,
      migration,
      connection,
    };
  }

  if (runtime.syncing) {
    return {
      status: "syncing",
      configured: true,
      pendingChanges,
      reconciliation,
      migration,
      connection,
    };
  }

  if (!connection.reachable && connection.lastFailedAt) {
    return {
      status: "offline",
      configured: true,
      pendingChanges,
      reconciliation,
      migration,
      connection,
    };
  }

  return {
    status: pendingChanges > 0 ? "pending" : "idle",
    configured: true,
    pendingChanges,
    reconciliation,
    migration,
    connection,
  };
}
