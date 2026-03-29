import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createEngine, createFileStorage } from "../src/index.js";
import { createEventFixture } from "./support/eventFixture.js";

describe("createFileStorage", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createStorageFilePath(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "lofipod-file-storage-"));
    tempDirectories.push(directory);
    return join(directory, "state.json");
  }

  it("persists entities across engine recreation", async () => {
    const { entity } = createEventFixture();
    const filePath = await createStorageFilePath();
    const firstEngine = createEngine({
      entities: [entity],
      storage: createFileStorage({
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
      storage: createFileStorage({
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
    const storage = createFileStorage({
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

  it("returns defensive copies from file-backed reads", async () => {
    const { entity } = createEventFixture();
    const filePath = await createStorageFilePath();
    const storage = createFileStorage({
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
