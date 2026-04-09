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

describe("Community Solid Server open write path", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    await waitForSolidServer(solidOpenBaseUrl);
  }, 30_000);

  async function waitForExpectation(
    check: () => Promise<void> | void,
    timeoutMs = 15_000,
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

  it("saves and syncs one entity to canonical and log resources", async () => {
    const entityId = `ev-123-${runId}`;
    const { entity } = createEventFixture();
    const realAdapter = createSolidPodAdapter({
      podBaseUrl: solidOpenBaseUrl,
    });
    const appendedPaths: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod: {
        logBasePath: "apps/my-journal/log/",
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: {
          async applyEntityPatch(request) {
            await realAdapter.applyEntityPatch(request);
          },
          async appendLogEntry(request) {
            appendedPaths.push(request.path);
            await realAdapter.appendLogEntry(request);
          },
        },
      },
    });

    await engine.save("event", {
      id: entityId,
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    await waitForExpectation(async () => {
      const canonicalResponse = await fetch(
        new URL(`events/${entityId}.ttl`, solidOpenBaseUrl),
      );
      const canonicalBody = await canonicalResponse.text();

      expect(canonicalResponse.ok).toBe(true);
      expect(canonicalBody).toContain("https://example.com/ns#title");
      expect(canonicalBody).toContain("Hello");
    });

    await waitForExpectation(() => {
      expect(appendedPaths).toHaveLength(1);
      expect(appendedPaths[0]).toMatch(/\.nt$/);
    });

    await waitForExpectation(async () => {
      const logResponse = await fetch(
        new URL(appendedPaths[0]!, solidOpenBaseUrl),
      );
      const logBody = await logResponse.text();

      expect(logResponse.ok).toBe(true);
      expect(logBody).toContain("<urn:lofipod:log:Change>");
      expect(logBody).toContain(`"${entityId}"`);
    });
  }, 30_000);

  it("applies a real N3 Patch update to an existing canonical resource", async () => {
    const entityId = `ev-456-${runId}`;
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      pod: {
        logBasePath: "apps/my-journal/log/",
      },
      storage: createMemoryStorage(),
      sync: {
        adapter: createSolidPodAdapter({
          podBaseUrl: solidOpenBaseUrl,
        }),
      },
    });

    await engine.save("event", {
      id: entityId,
      title: "First",
      time: {
        year: 2024,
      },
    });

    await waitForExpectation(async () => {
      const response = await fetch(
        new URL(`events/${entityId}.ttl`, solidOpenBaseUrl),
      );
      const body = await response.text();

      expect(response.ok).toBe(true);
      expect(body).toContain("First");
    });

    await engine.save("event", {
      id: entityId,
      title: "Updated",
      time: {
        year: 2025,
      },
    });

    await waitForExpectation(async () => {
      const response = await fetch(
        new URL(`events/${entityId}.ttl`, solidOpenBaseUrl),
      );
      const body = await response.text();

      expect(response.ok).toBe(true);
      expect(body).toContain("Updated");
      expect(body).toContain("2025");
      expect(body).not.toContain("First");
    });
  }, 30_000);
});
