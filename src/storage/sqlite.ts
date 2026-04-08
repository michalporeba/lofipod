import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import type {
  ListedEntityRecord,
  LocalChange,
  LocalStorageAdapter,
  LocalStorageTransaction,
  StoredEntityRecord,
  SyncMetadata,
} from "../types.js";
import { decodeStoredTriples, encodeStoredTriples } from "../rdf.js";
import {
  cloneLocalChange,
  cloneStoredRecord,
  cloneSyncMetadata,
} from "./shared.js";

type SqliteStorageOptions = {
  filePath: string;
};

type EntityRow = {
  entity_name: string;
  entity_id: string;
  root_uri: string;
  graph: string;
  projection: string;
  last_change_id: string | null;
  updated_order: number;
};

type ChangeRow = {
  change_id: string;
  entity_name: string;
  entity_id: string;
  parent_change_id: string | null;
  assertions: string;
  retractions: string;
  entity_projected: number;
  log_projected: number;
};

type MetaRow = {
  value: string;
};

const UPDATED_ORDER_KEY = "updatedOrder";
const SYNC_METADATA_KEY = "syncMetadata";

function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function hydrateStoredRecord(row: EntityRow): StoredEntityRecord<unknown> {
  return {
    rootUri: row.root_uri,
    graph: decodeStoredTriples(parseJson(row.graph)),
    projection: parseJson<unknown>(row.projection),
    lastChangeId: row.last_change_id,
    updatedOrder: row.updated_order,
  };
}

function hydrateListedEntityRecord(row: EntityRow): ListedEntityRecord {
  return {
    entityId: row.entity_id,
    record: cloneStoredRecord(hydrateStoredRecord(row)),
  };
}

function hydrateLocalChange(row: ChangeRow): LocalChange {
  return {
    entityName: row.entity_name,
    entityId: row.entity_id,
    changeId: row.change_id,
    parentChangeId: row.parent_change_id,
    assertions: decodeStoredTriples(parseJson(row.assertions)),
    retractions: decodeStoredTriples(parseJson(row.retractions)),
    entityProjected: Boolean(row.entity_projected),
    logProjected: Boolean(row.log_projected),
  };
}

function readStoredRecord(
  statement: Database.Statement<[string, string], EntityRow>,
  entityName: string,
  entityId: string,
): StoredEntityRecord<unknown> | null {
  const row = statement.get(entityName, entityId);
  return row ? cloneStoredRecord(hydrateStoredRecord(row)) : null;
}

function createDefaultSyncMetadata(): SyncMetadata {
  return {
    observedRemoteChangeIds: [],
  };
}

export function createSqliteStorage(
  options: SqliteStorageOptions,
): LocalStorageAdapter {
  ensureParentDirectory(options.filePath);

  const database = new Database(options.filePath);

  database.pragma("journal_mode = WAL");
  database.pragma("synchronous = NORMAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      entity_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      root_uri TEXT NOT NULL,
      graph TEXT NOT NULL,
      projection TEXT NOT NULL,
      last_change_id TEXT,
      updated_order INTEGER NOT NULL,
      PRIMARY KEY (entity_name, entity_id)
    );

    CREATE TABLE IF NOT EXISTS changes (
      change_id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      parent_change_id TEXT,
      assertions TEXT NOT NULL,
      retractions TEXT NOT NULL,
      entity_projected INTEGER NOT NULL DEFAULT 0,
      log_projected INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_changes_entity
      ON changes (entity_name, entity_id);

    CREATE INDEX IF NOT EXISTS idx_changes_pending
      ON changes (entity_projected, log_projected);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const readEntityStatement = database.prepare<[string, string], EntityRow>(`
    SELECT
      entity_name,
      entity_id,
      root_uri,
      graph,
      projection,
      last_change_id,
      updated_order
    FROM entities
    WHERE entity_name = ? AND entity_id = ?
  `);
  const listEntitiesStatement = database.prepare<[string], EntityRow>(`
    SELECT
      entity_name,
      entity_id,
      root_uri,
      graph,
      projection,
      last_change_id,
      updated_order
    FROM entities
    WHERE entity_name = ?
    ORDER BY updated_order DESC
  `);
  const listAllChangesStatement = database.prepare<[], ChangeRow>(`
    SELECT
      change_id,
      entity_name,
      entity_id,
      parent_change_id,
      assertions,
      retractions,
      entity_projected,
      log_projected
    FROM changes
    ORDER BY rowid
  `);
  const listPendingChangesStatement = database.prepare<[], ChangeRow>(`
    SELECT
      change_id,
      entity_name,
      entity_id,
      parent_change_id,
      assertions,
      retractions,
      entity_projected,
      log_projected
    FROM changes
    WHERE entity_projected = 0 OR log_projected = 0
    ORDER BY rowid
  `);
  const listEntityChangesStatement = database.prepare<[string], ChangeRow>(`
    SELECT
      change_id,
      entity_name,
      entity_id,
      parent_change_id,
      assertions,
      retractions,
      entity_projected,
      log_projected
    FROM changes
    WHERE entity_name = ?
    ORDER BY rowid
  `);
  const listScopedChangesStatement = database.prepare<
    [string, string],
    ChangeRow
  >(`
    SELECT
      change_id,
      entity_name,
      entity_id,
      parent_change_id,
      assertions,
      retractions,
      entity_projected,
      log_projected
    FROM changes
    WHERE entity_name = ? AND entity_id = ?
    ORDER BY rowid
  `);
  const readMetaStatement = database.prepare<[string], MetaRow>(`
    SELECT value
    FROM meta
    WHERE key = ?
  `);
  const writeEntityStatement = database.prepare<
    [string, string, string, string, string, string | null, number]
  >(`
    INSERT INTO entities (
      entity_name,
      entity_id,
      root_uri,
      graph,
      projection,
      last_change_id,
      updated_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_name, entity_id) DO UPDATE SET
      root_uri = excluded.root_uri,
      graph = excluded.graph,
      projection = excluded.projection,
      last_change_id = excluded.last_change_id,
      updated_order = excluded.updated_order
  `);
  const appendChangeStatement = database.prepare<
    [string, string, string, string | null, string, string, number, number]
  >(`
    INSERT INTO changes (
      change_id,
      entity_name,
      entity_id,
      parent_change_id,
      assertions,
      retractions,
      entity_projected,
      log_projected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const markChangeEntityProjectedStatement = database.prepare<[string]>(`
    UPDATE changes
    SET entity_projected = 1
    WHERE change_id = ?
  `);
  const markChangeLogProjectedStatement = database.prepare<[string]>(`
    UPDATE changes
    SET log_projected = 1
    WHERE change_id = ?
  `);
  const writeMetaStatement = database.prepare<[string, string]>(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value
  `);

  return {
    async readEntity(entityName, entityId) {
      return readStoredRecord(readEntityStatement, entityName, entityId);
    },

    async listEntities(entityName) {
      return listEntitiesStatement
        .all(entityName)
        .map(hydrateListedEntityRecord);
    },

    async listChanges(entityName, entityId) {
      const rows =
        entityId && entityName
          ? listScopedChangesStatement.all(entityName, entityId)
          : entityName
            ? listEntityChangesStatement.all(entityName)
            : listAllChangesStatement.all();

      return rows
        .map((row) => cloneLocalChange(hydrateLocalChange(row)))
        .filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        );
    },

    async listPendingChanges() {
      return listPendingChangesStatement
        .all()
        .map((row) => cloneLocalChange(hydrateLocalChange(row)));
    },

    async readSyncMetadata() {
      const row = readMetaStatement.get(SYNC_METADATA_KEY);

      return cloneSyncMetadata(
        row ? parseJson<SyncMetadata>(row.value) : createDefaultSyncMetadata(),
      );
    },

    async transact<T>(
      work: (transaction: LocalStorageTransaction) => Promise<T> | T,
    ): Promise<T> {
      const runTransaction = database.transaction(() => {
        const updatedOrderRow = readMetaStatement.get(UPDATED_ORDER_KEY);
        let updatedOrder = updatedOrderRow
          ? parseJson<number>(updatedOrderRow.value)
          : 0;

        const transaction: LocalStorageTransaction = {
          readEntity(entityName, entityId) {
            return readStoredRecord(readEntityStatement, entityName, entityId);
          },
          writeEntity(entityName, entityId, record) {
            writeEntityStatement.run(
              entityName,
              entityId,
              record.rootUri,
              serializeJson(encodeStoredTriples(record.graph)),
              serializeJson(record.projection),
              record.lastChangeId,
              record.updatedOrder,
            );
          },
          appendChange(change) {
            appendChangeStatement.run(
              change.changeId,
              change.entityName,
              change.entityId,
              change.parentChangeId,
              serializeJson(encodeStoredTriples(change.assertions)),
              serializeJson(encodeStoredTriples(change.retractions)),
              change.entityProjected ? 1 : 0,
              change.logProjected ? 1 : 0,
            );
          },
          markChangeEntityProjected(changeId) {
            markChangeEntityProjectedStatement.run(changeId);
          },
          markChangeLogProjected(changeId) {
            markChangeLogProjectedStatement.run(changeId);
          },
          readSyncMetadata() {
            const row = readMetaStatement.get(SYNC_METADATA_KEY);

            return cloneSyncMetadata(
              row
                ? parseJson<SyncMetadata>(row.value)
                : createDefaultSyncMetadata(),
            );
          },
          writeSyncMetadata(metadata) {
            writeMetaStatement.run(
              SYNC_METADATA_KEY,
              serializeJson(cloneSyncMetadata(metadata)),
            );
          },
          nextUpdatedOrder() {
            updatedOrder += 1;
            writeMetaStatement.run(
              UPDATED_ORDER_KEY,
              serializeJson(updatedOrder),
            );
            return updatedOrder;
          },
        };

        const result = work(transaction);

        if (result instanceof Promise) {
          throw new Error(
            "createSqliteStorage transactions must complete synchronously",
          );
        }

        return result;
      });

      return runTransaction.immediate();
    },
  };
}
