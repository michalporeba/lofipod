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
  pod?: {
    podBaseUrl: string;
    logBasePath?: string;
    authorization?: string;
    fetch?: typeof fetch;
  };
};

export type DemoApp = {
  engine: Engine;
  dataDir: string;
  close(): Promise<void>;
  addTask(input: { id?: string; title: string; due?: string }): Promise<Task>;
  listTasks(): Promise<Task[]>;
  completeTask(id: string): Promise<Task>;
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
  const engine = createEngine({
    entities: [...demoEntities],
    storage: createSqliteStorage({
      filePath: join(dataDir, "state.sqlite"),
    }),
    pod: options.pod
      ? {
          podBaseUrl: options.pod.podBaseUrl,
          logBasePath: options.pod.logBasePath ?? "apps/lifegraph-demo/log/",
        }
      : undefined,
    sync: options.pod
      ? {
          adapter: createSolidPodAdapter({
            podBaseUrl: options.pod.podBaseUrl,
            authorization: options.pod.authorization,
            fetch: options.pod.fetch,
          }),
        }
      : undefined,
  });

  return {
    engine,
    dataDir,

    async close() {
      await engine.dispose();
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
