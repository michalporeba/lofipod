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
  beforeAll(async () => {
    await waitForSolidServer(solidOpenBaseUrl);
  }, 30_000);

  it("saves and syncs one entity to canonical and log resources", async () => {
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
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    const canonicalResponse = await fetch(
      new URL("events/ev-123.ttl", solidOpenBaseUrl),
    );
    const canonicalBody = await canonicalResponse.text();

    expect(canonicalResponse.ok).toBe(true);
    expect(canonicalBody).toContain("https://example.com/ns#title");
    expect(canonicalBody).toContain("Hello");

    expect(appendedPaths).toHaveLength(1);

    const logResponse = await fetch(
      new URL(appendedPaths[0]!, solidOpenBaseUrl),
    );
    const logBody = await logResponse.text();

    expect(logResponse.ok).toBe(true);
    expect(logBody).toContain("urn:lofipod:log:Change");
    expect(logBody).toContain("ev-123");
  }, 30_000);

  it("applies a real N3 Patch update to an existing canonical resource", async () => {
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
      id: "ev-456",
      title: "First",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    await engine.save("event", {
      id: "ev-456",
      title: "Updated",
      time: {
        year: 2025,
      },
    });
    await engine.sync.now();

    const response = await fetch(
      new URL("events/ev-456.ttl", solidOpenBaseUrl),
    );
    const body = await response.text();

    expect(response.ok).toBe(true);
    expect(body).toContain("Updated");
    expect(body).toContain("2025");
    expect(body).not.toContain("First");
  }, 30_000);
});
