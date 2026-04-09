import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createEngine, createIndexedDbStorage, uri } from "../src/index.js";
import { createEventFixture } from "./support/eventFixture.js";

describe("createIndexedDbStorage", () => {
  let databaseCounter = 0;

  const createDatabaseName = () => `lofipod-test-${++databaseCounter}`;

  it("persists entities across engine recreation", async () => {
    const { entity } = createEventFixture();
    const databaseName = createDatabaseName();
    const storage = createIndexedDbStorage({
      databaseName,
    });

    const firstEngine = createEngine({
      entities: [entity],
      storage,
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
      storage: createIndexedDbStorage({
        databaseName,
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

  it("lists entities from newest to oldest", async () => {
    const { entity } = createEventFixture();
    const databaseName = createDatabaseName();
    const storage = createIndexedDbStorage({
      databaseName,
    });
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: {
        year: 2024,
      },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: {
        year: 2025,
      },
    });

    await expect(engine.list("event")).resolves.toEqual([
      {
        id: "ev-2",
        title: "Second",
        time: {
          year: 2025,
        },
      },
      {
        id: "ev-1",
        title: "First",
        time: {
          year: 2024,
        },
      },
    ]);
  });

  it("returns defensive copies from IndexedDB reads", async () => {
    const { entity } = createEventFixture();
    const databaseName = createDatabaseName();
    const storage = createIndexedDbStorage({
      databaseName,
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

  it("lists entities and changes correctly through indexed queries", async () => {
    const { entity } = createEventFixture();
    const databaseName = createDatabaseName();
    const storage = createIndexedDbStorage({
      databaseName,
    });
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: {
        year: 2024,
      },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: {
        year: 2025,
      },
    });
    await engine.save("event", {
      id: "ev-1",
      title: "First updated",
      time: {
        year: 2026,
      },
    });

    await expect(storage.listEntities("event")).resolves.toMatchObject([
      {
        entityId: "ev-1",
        record: {
          projection: {
            id: "ev-1",
            title: "First updated",
            time: {
              year: 2026,
            },
          },
        },
      },
      {
        entityId: "ev-2",
      },
    ]);

    await expect(storage.listChanges("event", "ev-1")).resolves.toHaveLength(2);
    await expect(storage.listChanges("event", "ev-2")).resolves.toHaveLength(1);
  });

  it("upgrades an existing version 1 database and preserves stored data", async () => {
    const { entity } = createEventFixture();
    const databaseName = createDatabaseName();

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        database.createObjectStore("entities", {
          keyPath: ["entityName", "entityId"],
        });
        database.createObjectStore("changes", {
          keyPath: "key",
        });
        database.createObjectStore("meta", {
          keyPath: "key",
        });
      };

      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(
          ["entities", "changes", "meta"],
          "readwrite",
        );
        const entities = transaction.objectStore("entities");
        const changes = transaction.objectStore("changes");
        const meta = transaction.objectStore("meta");

        entities.put({
          entityName: "event",
          entityId: "ev-123",
          rootUri: "https://example.com/id/event/ev-123",
          graph: [
            [
              "https://example.com/id/event/ev-123",
              "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              "https://example.com/ns#Event",
            ],
            [
              "https://example.com/id/event/ev-123",
              "https://example.com/ns#title",
              "Hello",
            ],
            [
              "https://example.com/id/event/ev-123",
              "https://example.com/ns#time",
              "https://example.com/id/event/ev-123#time",
            ],
            [
              "https://example.com/id/event/ev-123#time",
              "https://example.com/ns#year",
              2024,
            ],
          ],
          projection: {
            id: "ev-123",
            title: "Hello",
            time: {
              year: 2024,
            },
          },
          lastChangeId: "change-1",
          updatedOrder: 1,
        });
        changes.put({
          key: "event:ev-123:change-1",
          entityName: "event",
          entityId: "ev-123",
          changeId: "change-1",
          parentChangeId: null,
          timestamp: "1970-01-01T00:00:00.000Z",
          assertions: [],
          retractions: [],
          entityProjected: false,
          logProjected: false,
        });
        meta.put({
          key: "updatedOrder",
          value: 1,
        });
        meta.put({
          key: "syncMetadata",
          value: {
            observedRemoteChangeIds: [],
            persistedPodConfig: null,
            canonicalContainerVersions: {},
          },
        });

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      };

      request.onerror = () => reject(request.error);
    });

    const storage = createIndexedDbStorage({
      databaseName,
    });
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    await expect(storage.listChanges("event", "ev-123")).resolves.toHaveLength(
      1,
    );
    await expect(storage.listPendingChanges?.()).resolves.toHaveLength(1);
  });
});
