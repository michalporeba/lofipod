import type { EngineStorage } from "./support.js";
import type { StoredEntityRecord } from "../types.js";

export function isDeletionChange(change: {
  assertions: unknown[];
  retractions: unknown[];
}): boolean {
  return change.assertions.length === 0 && change.retractions.length > 0;
}

export function createLogRecord(rootUri: string): StoredEntityRecord<unknown> {
  return {
    rootUri,
    graph: [],
    projection: null,
    lastChangeId: null,
    updatedOrder: 0,
  };
}

export async function markSupersededChangeProjected(
  storage: EngineStorage,
  changeId: string,
): Promise<void> {
  await storage.transact((transaction) => {
    transaction.markChangeEntityProjected(changeId);
    transaction.markChangeLogProjected(changeId);
  });
}
