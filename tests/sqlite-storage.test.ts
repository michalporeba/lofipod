import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  createEngine,
  createSqliteStorage,
  defineEntity,
  defineVocabulary,
  isNamedNodeTerm,
  literal,
  rdf,
  stringValue,
  uri,
  type Triple,
} from "../src/node.js";
import { TaskEntity, demoVocabulary, type Task } from "../demo/entities.js";
import { createEventFixture } from "./support/eventFixture.js";

describe("createSqliteStorage", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createStorageFilePath(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "lofipod-sqlite-storage-"));
    tempDirectories.push(directory);
    return join(directory, "state.sqlite");
  }

  it("persists entities across engine recreation", async () => {
    const { entity } = createEventFixture();
    const filePath = await createStorageFilePath();
    const firstEngine = createEngine({
      entities: [entity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await firstEngine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    const secondEngine = createEngine({
      entities: [entity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
  });

  it("does not commit partial writes when a transaction fails", async () => {
    const { entity } = createEventFixture();
    const filePath = await createStorageFilePath();
    const storage = createSqliteStorage({
      filePath,
    });
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Before failure",
      time: {
        year: 2024,
      },
    });

    await expect(
      storage.transact((transaction) => {
        transaction.writeEntity("event", "ev-123", {
          rootUri: "https://example.com/id/event/ev-123",
          graph: [],
          projection: {
            id: "ev-123",
            title: "Broken write",
            time: {
              year: 1900,
            },
          },
          lastChangeId: "broken",
          updatedOrder: 999,
        });

        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Before failure",
      time: {
        year: 2024,
      },
    });
  });

  it("returns defensive copies from SQLite reads", async () => {
    const { entity } = createEventFixture();
    const filePath = await createStorageFilePath();
    const storage = createSqliteStorage({
      filePath,
    });
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    const stored = await storage.readEntity("event", "ev-123");

    if (!stored) {
      throw new Error("missing stored record");
    }

    stored.graph[0]![0] = uri("https://example.com/id/event/mutated");
    stored.projection = {
      id: "ev-123",
      title: "Mutated",
      time: {
        year: 1900,
      },
    };

    await expect(storage.readEntity("event", "ev-123")).resolves.toMatchObject({
      rootUri: "https://example.com/id/event/ev-123",
      projection: {
        id: "ev-123",
        title: "Hello",
        time: {
          year: 2024,
        },
      },
    });
  });

  it("preserves typed literal values that look like IRIs across restart", async () => {
    const ex = defineVocabulary({
      base: "https://example.com/",
      terms: {
        Bookmark: "ns#Bookmark",
        url: "ns#url",
      },
      uri({ base, entityName, id }) {
        return `${base}id/${entityName}/${id}`;
      },
    });
    const bookmarkEntity = defineEntity<{
      id: string;
      url: string;
    }>({
      kind: "bookmark",
      pod: {
        basePath: "bookmarks/",
      },
      rdfType: ex.Bookmark,
      id: (bookmark) => bookmark.id,
      uri: (bookmark) =>
        ex.uri({
          entityName: "bookmark",
          id: bookmark.id,
        }),
      toRdf(bookmark, { uri }) {
        const subject = uri(bookmark);

        return [
          [subject, rdf.type, ex.Bookmark],
          [subject, ex.url, literal(bookmark.url)],
        ] satisfies Triple[];
      },
      project(graph, { uri }) {
        const subject = uri();

        return {
          id: subject.value.split("/").at(-1) ?? "",
          url: stringValue(graph, subject, ex.url),
        };
      },
    });

    const filePath = await createStorageFilePath();
    const firstEngine = createEngine({
      entities: [bookmarkEntity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await firstEngine.save("bookmark", {
      id: "bookmark-1",
      url: "https://literal.example/resource",
    });

    const secondEngine = createEngine({
      entities: [bookmarkEntity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await expect(secondEngine.get("bookmark", "bookmark-1")).resolves.toEqual({
      id: "bookmark-1",
      url: "https://literal.example/resource",
    });
  });

  it("reprojects legacy task graphs during get and persists the repair as a normal local change", async () => {
    const filePath = await createStorageFilePath();
    const storage = createSqliteStorage({
      filePath,
    });
    const firstEngine = createEngine({
      entities: [TaskEntity],
      storage,
    });

    await firstEngine.save<Task>("task", {
      id: "task-legacy-repair",
      title: "Legacy reprojection",
      status: "todo",
      priority: "high",
    });

    await storage.transact((transaction) => {
      const record = transaction.readEntity("task", "task-legacy-repair");

      if (!record) {
        throw new Error("missing task record");
      }

      transaction.writeEntity("task", "task-legacy-repair", {
        ...record,
        graph: record.graph.filter(
          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
        ),
        projection: {
          id: "task-legacy-repair",
          title: "Legacy reprojection",
          status: "todo",
        },
      });
    });

    const secondEngine = createEngine({
      entities: [TaskEntity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await expect(
      secondEngine.get<Task>("task", "task-legacy-repair"),
    ).resolves.toEqual({
      id: "task-legacy-repair",
      title: "Legacy reprojection",
      status: "todo",
      priority: "normal",
      due: undefined,
    });

    const repairedRecord = await storage.readEntity(
      "task",
      "task-legacy-repair",
    );
    const changes = await storage.listChanges("task", "task-legacy-repair");
    const repairChange = changes.at(-1);

    expect(
      repairedRecord?.graph.some(
        ([subject, predicate, object]) =>
          subject.value ===
            demoVocabulary.uri({
              entityName: "task",
              id: "task-legacy-repair",
            }).value &&
          predicate.value === demoVocabulary.priority.value &&
          isNamedNodeTerm(object) &&
          object.value === demoVocabulary.PriorityNormal.value,
      ),
    ).toBe(true);
    expect(changes).toHaveLength(2);
    expect(
      repairChange?.assertions.some(
        ([, predicate, object]) =>
          predicate.value === demoVocabulary.priority.value &&
          isNamedNodeTerm(object) &&
          object.value === demoVocabulary.PriorityNormal.value,
      ),
    ).toBe(true);
  });

  it("reprojects legacy task graphs during list after restart and keeps deterministic evolved outputs", async () => {
    const filePath = await createStorageFilePath();
    const storage = createSqliteStorage({
      filePath,
    });
    const firstEngine = createEngine({
      entities: [TaskEntity],
      storage,
    });

    await firstEngine.save<Task>("task", {
      id: "task-legacy-list-a",
      title: "Legacy list A",
      status: "todo",
      priority: "low",
    });
    await firstEngine.save<Task>("task", {
      id: "task-legacy-list-b",
      title: "Legacy list B",
      status: "done",
      priority: "high",
    });

    await storage.transact((transaction) => {
      const first = transaction.readEntity("task", "task-legacy-list-a");
      const second = transaction.readEntity("task", "task-legacy-list-b");

      if (!first || !second) {
        throw new Error("missing legacy task records");
      }

      transaction.writeEntity("task", "task-legacy-list-a", {
        ...first,
        graph: first.graph.filter(
          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
        ),
        projection: {
          id: "task-legacy-list-a",
          title: "Legacy list A",
          status: "todo",
        },
      });
      transaction.writeEntity("task", "task-legacy-list-b", {
        ...second,
        graph: second.graph.filter(
          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
        ),
        projection: {
          id: "task-legacy-list-b",
          title: "Legacy list B",
          status: "done",
        },
      });
    });

    const secondEngine = createEngine({
      entities: [TaskEntity],
      storage: createSqliteStorage({
        filePath,
      }),
    });

    await expect(secondEngine.list<Task>("task")).resolves.toEqual([
      {
        id: "task-legacy-list-b",
        title: "Legacy list B",
        status: "done",
        priority: "normal",
        due: undefined,
      },
      {
        id: "task-legacy-list-a",
        title: "Legacy list A",
        status: "todo",
        priority: "normal",
        due: undefined,
      },
    ]);

    const changesA = await storage.listChanges("task", "task-legacy-list-a");
    const changesB = await storage.listChanges("task", "task-legacy-list-b");

    expect(changesA).toHaveLength(2);
    expect(changesB).toHaveLength(2);
    expect(
      changesA
        .at(-1)
        ?.assertions.some(
          ([, predicate]) => predicate.value === demoVocabulary.priority.value,
        ),
    ).toBe(true);
    expect(
      changesB
        .at(-1)
        ?.assertions.some(
          ([, predicate]) => predicate.value === demoVocabulary.priority.value,
        ),
    ).toBe(true);
  });
});
