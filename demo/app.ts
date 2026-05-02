import { homedir } from "node:os";
import { join } from "node:path";

import {
  type BootstrapResult,
  createEngine,
  createSolidPodAdapter,
  createSqliteStorage,
  type Engine,
  type SyncState,
} from "../src/node.js";
import {
  demoEntities,
  JournalEntryEntity,
  TaskEntity,
  type JournalEntry,
  type Task,
} from "./entities.js";

type CreateDemoAppOptions = {
  dataDir?: string;
  now?: () => string;
};

export type DemoPodSyncOptions = {
  podBaseUrl: string;
  logBasePath?: string;
  authorization?: string;
  fetch?: typeof fetch;
};

type CreateDemoPodSyncOptions = {
  pod: {
    podBaseUrl: string;
    logBasePath: string;
    authorization?: string;
    fetch?: typeof fetch;
  };
};

export type DemoApp = {
  engine: Engine;
  dataDir: string;
  close(): Promise<void>;
  attachPodSync(options: DemoPodSyncOptions): Promise<void>;
  addTask(input: { id?: string; title: string; due?: string }): Promise<Task>;
  getTask(id: string): Promise<Task>;
  listTasks(): Promise<Task[]>;
  completeTask(id: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  addJournalEntry(input: {
    id?: string;
    title: string;
    text: string;
    entryDate: string;
    aboutTaskId?: string;
  }): Promise<JournalEntry>;
  listJournalEntries(): Promise<JournalEntry[]>;
  syncState(): Promise<SyncState>;
  syncNow(): Promise<void>;
  syncBootstrap(): Promise<BootstrapResult>;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDemoLogBasePath(logBasePath?: string): string {
  return logBasePath ?? "apps/lifegraph-demo/log/";
}

function createDemoPodSyncOptions(
  options: DemoPodSyncOptions,
): CreateDemoPodSyncOptions {
  return {
    pod: {
      podBaseUrl: options.podBaseUrl,
      logBasePath: normalizeDemoLogBasePath(options.logBasePath),
      authorization: options.authorization,
      fetch: options.fetch,
    },
  };
}

export function resolveDemoDataDir(appName = "lifegraph-demo"): string {
  const xdgCache = process.env.XDG_CACHE_HOME;

  if (xdgCache) {
    return join(xdgCache, appName);
  }

  return join(homedir(), ".cache", appName);
}

export function createDemoApp(options: CreateDemoAppOptions = {}): DemoApp {
  const dataDir = options.dataDir ?? resolveDemoDataDir();
  const now = options.now ?? defaultNow;
  // Keep the demo's engine wiring environment-neutral at the root package
  // boundary. Runtime-specific Pod sync is attached explicitly below.
  const engine = createEngine({
    entities: [...demoEntities],
    storage: createSqliteStorage({
      filePath: join(dataDir, "state.sqlite"),
    }),
  });

  return {
    engine,
    dataDir,

    async close() {
      await engine.dispose();
    },

    async attachPodSync(options) {
      const syncOptions = createDemoPodSyncOptions(options);

      await engine.sync.attach({
        adapter: createSolidPodAdapter({
          podBaseUrl: syncOptions.pod.podBaseUrl,
          authorization: syncOptions.pod.authorization,
          fetch: syncOptions.pod.fetch,
        }),
        podBaseUrl: syncOptions.pod.podBaseUrl,
        logBasePath: syncOptions.pod.logBasePath,
      });
    },

    async addTask(input) {
      const task: Task = {
        id: input.id ?? createId("task"),
        title: input.title,
        status: "todo",
        due: input.due,
      };

      return engine.save<Task>(TaskEntity.kind, task);
    },

    async getTask(id) {
      const task = await engine.get<Task>(TaskEntity.kind, id);

      if (!task) {
        throw new Error(`Unknown task: ${id}`);
      }

      return task;
    },

    async listTasks() {
      return engine.list<Task>(TaskEntity.kind);
    },

    async completeTask(id) {
      const existing = await engine.get<Task>(TaskEntity.kind, id);

      if (!existing) {
        throw new Error(`Unknown task: ${id}`);
      }

      return engine.save<Task>(TaskEntity.kind, {
        ...existing,
        status: "done",
      });
    },

    async deleteTask(id) {
      await engine.delete(TaskEntity.kind, id);
    },

    async addJournalEntry(input) {
      const timestamp = now();

      if (input.aboutTaskId) {
        const task = await engine.get<Task>(TaskEntity.kind, input.aboutTaskId);

        if (!task) {
          throw new Error(`Unknown task: ${input.aboutTaskId}`);
        }
      }

      const entry: JournalEntry = {
        id: input.id ?? createId("journal-entry"),
        title: input.title,
        text: input.text,
        entryDate: input.entryDate,
        aboutTaskId: input.aboutTaskId,
        createdAt: timestamp,
        modifiedAt: timestamp,
      };

      return engine.save<JournalEntry>(JournalEntryEntity.kind, entry);
    },

    async listJournalEntries() {
      return engine.list<JournalEntry>(JournalEntryEntity.kind);
    },

    async syncState() {
      return engine.sync.state();
    },

    async syncNow() {
      await engine.sync.now();
    },

    async syncBootstrap() {
      return engine.sync.bootstrap();
    },
  };
}
