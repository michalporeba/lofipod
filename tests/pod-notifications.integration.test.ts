import { beforeAll, describe, expect, it } from "vitest";

import {
  createEngine,
  createMemoryStorage,
  createSolidPodAdapter,
} from "../src/index.js";
import { createEventFixture } from "./support/eventFixture.js";
import { waitForSolidServer } from "./support/solidServer.js";

const solidOpenBaseUrl =
  process.env.SOLID_OPEN_BASE_URL ?? "http://localhost:3400/";

describe("Community Solid Server notifications", () => {
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

  async function ensureContainer(path: string): Promise<void> {
    const segments = path.split("/").filter(Boolean);

    for (let index = 0; index < segments.length; index += 1) {
      const slug = segments[index]!;
      const parentPath = segments.slice(0, index).join("/");
      const parentUrl = new URL(
        parentPath ? `${parentPath}/` : "",
        solidOpenBaseUrl,
      );
      const response = await fetch(parentUrl, {
        method: "POST",
        headers: {
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          Slug: slug,
        },
      });

      if (response.ok || response.status === 409) {
        continue;
      }

      throw new Error(`Failed to create container ${path}: ${response.status}`);
    }
  }

  async function putExternalCanonicalEvent(
    basePath: string,
    entityId: string,
    title: string,
    year: number,
  ): Promise<void> {
    const subject = `https://example.com/id/event/${entityId}`;
    const time = `${subject}#time`;

    await ensureContainer(basePath);
    const response = await fetch(
      new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
      {
        method: "PUT",
        headers: {
          "Content-Type": "text/turtle",
        },
        body: [
          "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
          `<${subject}> rdf:type <https://example.com/ns#Event> .`,
          `<${subject}> <https://example.com/ns#title> "${title}" .`,
          `<${subject}> <https://example.com/ns#time> <${time}> .`,
          `<${time}> <https://example.com/ns#year> ${year} .`,
          "",
        ].join("\n"),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to write canonical entity ${entityId}: ${response.status}`,
      );
    }
  }

  async function deleteExternalCanonicalEvent(
    basePath: string,
    entityId: string,
  ): Promise<void> {
    const response = await fetch(
      new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
      {
        method: "DELETE",
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to delete canonical entity ${entityId}: ${response.status}`,
      );
    }
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

  it("applies a remote lofipod change without calling sync.now() when the log container notifies", async () => {
    const basePath = `events-notify-log-${runId}/`;
    const logBasePath = `apps/notify-log-${runId}/log/`;
    const entityId = `ev-log-notify-${runId}`;
    await ensureContainer(basePath);
    await ensureContainer(`${logBasePath}event/`);
    const entity = createScopedEntity(basePath);
    const realAdapter = createSolidPodAdapter({
      podBaseUrl: solidOpenBaseUrl,
    });
    const subscribedPaths: string[] = [];
    const firstStorage = createMemoryStorage();
    const firstEngine = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: firstStorage,
      sync: {
        adapter: {
          ...realAdapter,
          async subscribeToContainer(containerPath, onNotification) {
            if (containerPath === `${logBasePath}event/`) {
              const subscription = await realAdapter.subscribeToContainer!(
                containerPath,
                onNotification,
              );
              subscribedPaths.push(containerPath);
              return subscription;
            }

            throw new Error(
              "skip canonical container subscriptions in this test",
            );
          },
        },
      },
    });
    const secondEngine = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: realAdapter,
      },
    });

    await waitForExpectation(() => {
      expect(subscribedPaths).toContain(`${logBasePath}event/`);
    });

    await secondEngine.save("event", {
      id: entityId,
      title: "Remote via notification",
      time: {
        year: 2026,
      },
    });
    await secondEngine.sync.now();

    await waitForExpectation(async () => {
      await expect(firstEngine.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "Remote via notification",
        time: {
          year: 2026,
        },
      });
    });
    await waitForExpectation(async () => {
      const changes = await firstStorage.listChanges("event", entityId);

      expect(changes.length).toBeGreaterThan(0);
    });
  }, 30_000);

  it("reconciles an external canonical edit without calling sync.now() when the entity container notifies", async () => {
    const basePath = `events-notify-canonical-${runId}/`;
    const logBasePath = `apps/notify-canonical-${runId}/log/`;
    const entityId = `ev-canonical-notify-${runId}`;
    await ensureContainer(basePath);
    const entity = createScopedEntity(basePath);
    const realAdapter = createSolidPodAdapter({
      podBaseUrl: solidOpenBaseUrl,
    });
    const subscribedPaths: string[] = [];
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      pod: {
        logBasePath,
      },
      storage,
      sync: {
        adapter: {
          ...realAdapter,
          async subscribeToContainer(containerPath, onNotification) {
            if (containerPath === basePath) {
              const subscription = await realAdapter.subscribeToContainer!(
                containerPath,
                onNotification,
              );
              subscribedPaths.push(containerPath);
              return subscription;
            }

            throw new Error("skip log container subscriptions in this test");
          },
        },
      },
    });

    await waitForExpectation(() => {
      expect(subscribedPaths).toContain(basePath);
    });

    await engine.save("event", {
      id: entityId,
      title: "Local",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    await deleteExternalCanonicalEvent(basePath, entityId);
    await putExternalCanonicalEvent(basePath, entityId, "External", 2027);

    await waitForExpectation(async () => {
      await expect(engine.get("event", entityId)).resolves.toEqual({
        id: entityId,
        title: "External",
        time: {
          year: 2027,
        },
      });
    });
    await waitForExpectation(async () => {
      const changes = await storage.listChanges("event", entityId);
      const latest = changes.at(-1);

      expect(latest?.entityProjected).toBe(true);
      expect(latest?.logProjected).toBe(false);
    });
  }, 30_000);
});
