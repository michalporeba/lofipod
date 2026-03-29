import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
  SyncMetadata,
} from "../types.js";
import {
  cloneLocalChange,
  cloneStoredRecord,
  cloneSyncMetadata,
  createListedEntityRecord,
} from "./shared.js";

type FileStorageOptions = {
  filePath: string;
};

type FileStorageState = {
  records: Record<string, StoredEntityRecord<unknown>>;
  changes: LocalChange[];
  syncMetadata: SyncMetadata;
  updatedOrder: number;
};

const EMPTY_STATE: FileStorageState = {
  records: {},
  changes: [],
  syncMetadata: {
    observedRemoteChangeIds: [],
  },
  updatedOrder: 0,
};

function cloneState(state: FileStorageState): FileStorageState {
  return {
    records: Object.fromEntries(
      Object.entries(state.records).map(([key, value]) => [
        key,
        cloneStoredRecord(value),
      ]),
    ),
    changes: state.changes.map(cloneLocalChange),
    syncMetadata: cloneSyncMetadata(state.syncMetadata),
    updatedOrder: state.updatedOrder,
  };
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function readState(filePath: string): Promise<FileStorageState> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileStorageState>;

    return {
      records: Object.fromEntries(
        Object.entries(parsed.records ?? {}).map(([key, value]) => [
          key,
          cloneStoredRecord(value as StoredEntityRecord<unknown>),
        ]),
      ),
      changes: (parsed.changes ?? []).map((change) =>
        cloneLocalChange(change as LocalChange),
      ),
      syncMetadata: cloneSyncMetadata({
        observedRemoteChangeIds:
          (parsed.syncMetadata?.observedRemoteChangeIds as
            | string[]
            | undefined) ?? [],
      }),
      updatedOrder: Number(parsed.updatedOrder ?? 0),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return cloneState(EMPTY_STATE);
    }

    throw error;
  }
}

async function writeState(
  filePath: string,
  state: FileStorageState,
): Promise<void> {
  await ensureParentDirectory(filePath);

  const tempPath = join(
    dirname(filePath),
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );

  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export function createFileStorage(
  options: FileStorageOptions,
): LocalStorageAdapter {
  const { filePath } = options;

  return {
    async readEntity(entityName, entityId) {
      const state = await readState(filePath);
      const record = state.records[`${entityName}:${entityId}`];

      return record ? cloneStoredRecord(record) : null;
    },

    async listEntities(entityName) {
      const state = await readState(filePath);

      return Object.entries(state.records)
        .filter(([key]) => key.startsWith(`${entityName}:`))
        .map(([key, record]) =>
          createListedEntityRecord(entityName, key, record),
        )
        .sort(
          (left, right) => right.record.updatedOrder - left.record.updatedOrder,
        );
    },

    async listChanges(entityName, entityId) {
      const state = await readState(filePath);

      return state.changes
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        )
        .map(cloneLocalChange);
    },

    async readSyncMetadata() {
      const state = await readState(filePath);
      return cloneSyncMetadata(state.syncMetadata);
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const state = await readState(filePath);
      const draft = cloneState(state);

      const transaction: LocalStorageTransaction = {
        readEntity(entityName, entityId) {
          const record = draft.records[`${entityName}:${entityId}`];
          return record ? cloneStoredRecord(record) : null;
        },
        writeEntity(entityName, entityId, record) {
          draft.records[`${entityName}:${entityId}`] =
            cloneStoredRecord(record);
        },
        appendChange(change) {
          draft.changes.push(cloneLocalChange(change));
        },
        markChangeEntityProjected(changeId) {
          draft.changes = draft.changes.map((change) =>
            change.changeId === changeId
              ? {
                  ...change,
                  entityProjected: true,
                }
              : change,
          );
        },
        markChangeLogProjected(changeId) {
          draft.changes = draft.changes.map((change) =>
            change.changeId === changeId
              ? {
                  ...change,
                  logProjected: true,
                }
              : change,
          );
        },
        readSyncMetadata() {
          return cloneSyncMetadata(draft.syncMetadata);
        },
        writeSyncMetadata(metadata) {
          draft.syncMetadata = cloneSyncMetadata(metadata);
        },
        nextUpdatedOrder() {
          draft.updatedOrder += 1;
          return draft.updatedOrder;
        },
      };

      const result = await work(transaction);
      await writeState(filePath, draft);
      return result;
    },
  };
}
