import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createEngine, createIndexedDbStorage } from "../src/index.js";
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

    stored.graph[0]![0] = "https://example.com/id/event/mutated";
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
});
