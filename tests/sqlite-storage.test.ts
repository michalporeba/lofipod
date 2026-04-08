import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  createEngine,
  createSqliteStorage,
  defineEntity,
  defineVocabulary,
  literal,
  objectOf,
  rdf,
  stringValue,
  uri,
  type Triple,
} from "../src/index.js";
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
      name: "bookmark",
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
          [
            subject,
            ex.url,
            literal(bookmark.url),
          ],
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
});
