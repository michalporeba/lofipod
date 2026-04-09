import type { LocalChange } from "./types.js";

export const DEFAULT_CHANGE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export type Fork = {
  entityName: string;
  entityId: string;
  parentChangeId: string;
  branches: LocalChange[];
};

export function createChangeTimestamp(): string {
  return new Date().toISOString();
}

export function normalizeChangeTimestamp(timestamp?: string | null): string {
  return timestamp ?? DEFAULT_CHANGE_TIMESTAMP;
}

export function detectForks(changes: LocalChange[]): Fork[] {
  const forks = new Map<string, Fork>();

  for (const change of changes) {
    if (!change.parentChangeId) {
      continue;
    }

    const key = `${change.entityName}:${change.entityId}:${change.parentChangeId}`;
    const existing = forks.get(key);

    if (existing) {
      existing.branches.push(change);
      continue;
    }

    forks.set(key, {
      entityName: change.entityName,
      entityId: change.entityId,
      parentChangeId: change.parentChangeId,
      branches: [change],
    });
  }

  return Array.from(forks.values()).filter((fork) => fork.branches.length > 1);
}
