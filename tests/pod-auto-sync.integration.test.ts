import { beforeAll, describe, expect, it } from "vitest";

import {
  createEngine,
  createMemoryStorage,
  createSolidPodAdapter,
} from "../src/node.js";
import { createEventFixture } from "./support/eventFixture.js";
import { waitForSolidServer } from "./support/solidServer.js";

const solidOpenBaseUrl =
  process.env.SOLID_OPEN_BASE_URL ?? "http://localhost:3400/";

describe("Community Solid Server auto sync", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    await waitForSolidServer(solidOpenBaseUrl);
  }, 30_000);

  async function waitForExpectation(
    check: () => Promise<void> | void,
    timeoutMs = 10_000,
  ): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        await check();
        return;
      } catch {
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
      }
    }

    await check();
  }

  function createScopedEntity(basePath: string) {
    const { entity } = createEventFixture();

    return {
      ...entity,
      pod: {
        basePath,
      },
    };
  }

  function createPollingOnlyAdapter() {
    const realAdapter = createSolidPodAdapter({
      podBaseUrl: solidOpenBaseUrl,
    });

    return {
      ...realAdapter,
      subscribeToContainer: undefined,
    };
  }

  it("pushes canonical and log updates after save without calling sync.now()", async () => {
    const entityId = `ev-auto-save-${runId}`;
    const basePath = `events-auto-save-${runId}/`;
    const logBasePath = `apps/auto-save-${runId}/log/`;
    const entity = createScopedEntity(basePath);
    const adapter = createPollingOnlyAdapter();
    const appendedPaths: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: {
          ...adapter,
          async appendLogEntry(request) {
            appendedPaths.push(request.path);
            await adapter.appendLogEntry(request);
          },
        },
      },
    });

    await engine.save("event", {
      id: entityId,
      title: "Auto push",
      time: {
        year: 2026,
      },
    });

    await waitForExpectation(async () => {
      const response = await fetch(
        new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
      );
      const body = await response.text();

      expect(response.ok).toBe(true);
      expect(body).toContain("Auto push");
    });
    await waitForExpectation(() => {
      expect(appendedPaths).toHaveLength(1);
    });
    await waitForExpectation(async () => {
      const response = await fetch(
        new URL(appendedPaths[0]!, solidOpenBaseUrl),
      );
      const body = await response.text();

      expect(response.ok).toBe(true);
      expect(body).toContain(`"${entityId}"`);
    });
  }, 30_000);

  it("pulls remote log changes automatically on attach without calling sync.now()", async () => {
    const entityId = `ev-auto-attach-${runId}`;
    const basePath = `events-auto-attach-${runId}/`;
    const logBasePath = `apps/auto-attach-${runId}/log/`;
    const entity = createScopedEntity(basePath);
    const producer = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createPollingOnlyAdapter(),
      },
    });
    const consumer = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await producer.save("event", {
      id: entityId,
      title: "Remote before attach",
      time: {
        year: 2027,
      },
    });
    await producer.sync.now();

    await consumer.sync.attach({
      adapter: createPollingOnlyAdapter(),
      podBaseUrl: solidOpenBaseUrl,
      logBasePath,
    });

    await waitForExpectation(async () => {
      await expect(consumer.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "Remote before attach",
        time: {
          year: 2027,
        },
      });
    });
  }, 30_000);

  it("polls for remote changes without notifications or manual sync.now()", async () => {
    const entityId = `ev-polled-${runId}`;
    const basePath = `events-polled-${runId}/`;
    const logBasePath = `apps/polled-${runId}/log/`;
    const entity = createScopedEntity(basePath);
    const producer = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createPollingOnlyAdapter(),
      },
    });
    const consumer = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createPollingOnlyAdapter(),
        pollIntervalMs: 250,
      },
    });

    await producer.save("event", {
      id: entityId,
      title: "Polled from Pod",
      time: {
        year: 2028,
      },
    });
    await producer.sync.now();

    await waitForExpectation(async () => {
      await expect(consumer.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "Polled from Pod",
        time: {
          year: 2028,
        },
      });
    }, 15_000);
  }, 30_000);

  it("retries pending local changes automatically on a later poll after attach recovers", async () => {
    const entityId = `ev-reconnect-${runId}`;
    const basePath = `events-reconnect-${runId}/`;
    const logBasePath = `apps/reconnect-${runId}/log/`;
    const entity = createScopedEntity(basePath);
    const adapter = createPollingOnlyAdapter();
    let shouldFail = true;
    let patchAttempts = 0;
    const appendedPaths: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
    });

    await engine.save("event", {
      id: entityId,
      title: "Retry after reconnect",
      time: {
        year: 2029,
      },
    });

    await engine.sync.attach({
      adapter: {
        ...adapter,
        async applyEntityPatch(request) {
          patchAttempts += 1;

          if (shouldFail) {
            throw new Error("temporary Pod outage");
          }

          await adapter.applyEntityPatch(request);
        },
        async appendLogEntry(request) {
          appendedPaths.push(request.path);
          await adapter.appendLogEntry(request);
        },
      },
      podBaseUrl: solidOpenBaseUrl,
      logBasePath,
      pollIntervalMs: 250,
    });

    await waitForExpectation(async () => {
      await expect(engine.sync.state()).resolves.toMatchObject({
        status: "offline",
        pendingChanges: 1,
        connection: {
          reachable: false,
          lastFailureReason: "temporary Pod outage",
        },
      });
      expect(patchAttempts).toBe(1);
      expect(appendedPaths).toHaveLength(0);
    });

    shouldFail = false;

    await waitForExpectation(async () => {
      const response = await fetch(
        new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
      );
      const body = await response.text();

      expect(response.ok).toBe(true);
      expect(body).toContain("Retry after reconnect");
    }, 15_000);

    await waitForExpectation(async () => {
      expect(patchAttempts).toBe(2);
      expect(appendedPaths).toHaveLength(1);
      await expect(engine.sync.state()).resolves.toMatchObject({
        status: "idle",
        pendingChanges: 0,
        connection: {
          reachable: true,
        },
      });
    }, 15_000);
  }, 30_000);

  it("replays ongoing supported create/update/delete changes from another attached client", async () => {
    const entityId = `ev-ongoing-${runId}`;
    const basePath = `events-ongoing-${runId}/`;
    const logBasePath = `apps/ongoing-${runId}/log/`;
    const entity = createScopedEntity(basePath);
    const producer = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createPollingOnlyAdapter(),
        pollIntervalMs: 250,
      },
    });
    const consumer = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createPollingOnlyAdapter(),
        pollIntervalMs: 250,
      },
    });

    await producer.save("event", {
      id: entityId,
      title: "Created on producer",
      time: {
        year: 2030,
      },
    });

    await waitForExpectation(async () => {
      await expect(consumer.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "Created on producer",
        time: {
          year: 2030,
        },
      });
    }, 15_000);

    await producer.save("event", {
      id: entityId,
      title: "Updated on producer",
      time: {
        year: 2031,
      },
    });

    await waitForExpectation(async () => {
      await expect(consumer.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "Updated on producer",
        time: {
          year: 2031,
        },
      });
    }, 15_000);

    await producer.delete("event", entityId);

    await waitForExpectation(async () => {
      await expect(consumer.get("event", entityId)).resolves.toBeNull();
      await expect(consumer.list("event")).resolves.toEqual([]);
    }, 15_000);
  }, 40_000);
});
