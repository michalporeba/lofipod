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

describe("Community Solid Server canonical reconciliation", () => {
  function createRunId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  beforeAll(async () => {
    await waitForSolidServer(solidOpenBaseUrl);
  }, 30_000);

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

  function eventResourceBody(
    entityId: string,
    title: string,
    year: number,
  ): string {
    const subject = `https://example.com/id/event/${entityId}`;
    const time = `${subject}#time`;

    return [
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
      `<${subject}> rdf:type <https://example.com/ns#Event> .`,
      `<${subject}> <https://example.com/ns#title> "${title}" .`,
      `<${subject}> <https://example.com/ns#time> <${time}> .`,
      `<${time}> <https://example.com/ns#year> ${year} .`,
      "",
    ].join("\n");
  }

  async function putExternalCanonicalEvent(
    basePath: string,
    entityId: string,
    title: string,
    year: number,
  ): Promise<void> {
    await ensureContainer(basePath);
    const response = await fetch(
      new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
      {
        method: "PUT",
        headers: {
          "Content-Type": "text/turtle",
        },
        body: eventResourceBody(entityId, title, year),
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

  async function readCanonicalBody(
    basePath: string,
    entityId: string,
  ): Promise<string> {
    const response = await fetch(
      new URL(`${basePath}${entityId}.ttl`, solidOpenBaseUrl),
    );

    if (!response.ok) {
      throw new Error(
        `Failed to read canonical entity ${entityId}: ${response.status}`,
      );
    }

    return response.text();
  }

  function createSyncedEngine() {
    const { entity } = createEventFixture();
    const runId = createRunId();
    const basePath = `events-${runId}/`;
    const logBasePath = `apps/my-journal-${runId}/log/`;
    const realAdapter = createSolidPodAdapter({
      podBaseUrl: solidOpenBaseUrl,
    });
    const scopedEntity = {
      ...entity,
      pod: {
        basePath,
      },
    };

    return {
      engine: createEngine({
        entities: [scopedEntity],
        pod: {
          logBasePath,
        },
        storage: createMemoryStorage(),
        sync: {
          adapter: {
            ...realAdapter,
            subscribeToContainer: undefined,
          },
        },
      }),
      pod: {
        basePath,
        logBasePath,
      },
    };
  }

  it("reconciles an external canonical update and then appends it to the log", async () => {
    const runId = createRunId();
    const entityId = `ev-external-update-${runId}`;
    const { engine, pod } = createSyncedEngine();

    await engine.save("event", {
      id: entityId,
      title: "Local",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    await deleteExternalCanonicalEvent(pod.basePath, entityId);
    await putExternalCanonicalEvent(pod.basePath, entityId, "External", 2026);
    await expect(readCanonicalBody(pod.basePath, entityId)).resolves.toContain(
      "External",
    );

    await engine.sync.now();

    await expect(engine.get("event", entityId)).resolves.toEqual({
      id: entityId,
      title: "External",
      time: {
        year: 2026,
      },
    });
    const reconciledState = await engine.sync.state();

    expect(reconciledState).toMatchObject({
      status: "pending",
      configured: true,
    });
    expect(reconciledState.pendingChanges).toBeGreaterThan(0);

    await engine.sync.now();

    await expect(engine.sync.state()).resolves.toMatchObject({
      status: "idle",
      configured: true,
      pendingChanges: 0,
      connection: {
        reachable: true,
        lastSyncedAt: expect.any(String),
      },
    });
  }, 30_000);

  it("imports a newly created external canonical resource during sync", async () => {
    const runId = createRunId();
    const entityId = `ev-external-create-${runId}`;
    const { engine, pod } = createSyncedEngine();

    await putExternalCanonicalEvent(pod.basePath, entityId, "Imported", 2027);
    await engine.sync.now();

    await expect(engine.get("event", entityId)).resolves.toEqual({
      id: entityId,
      title: "Imported",
      time: {
        year: 2027,
      },
    });
    const importedState = await engine.sync.state();

    expect(importedState).toMatchObject({
      status: "pending",
      configured: true,
    });
    expect(importedState.pendingChanges).toBeGreaterThan(0);

    await engine.sync.now();

    await expect(engine.sync.state()).resolves.toMatchObject({
      status: "idle",
      configured: true,
      pendingChanges: 0,
      connection: {
        reachable: true,
        lastSyncedAt: expect.any(String),
      },
    });
  }, 30_000);

  it("removes a local entity when its canonical resource is deleted externally", async () => {
    const runId = createRunId();
    const entityId = `ev-external-delete-${runId}`;
    const { engine, pod } = createSyncedEngine();

    await engine.save("event", {
      id: entityId,
      title: "Delete me",
      time: {
        year: 2025,
      },
    });
    await engine.sync.now();

    await deleteExternalCanonicalEvent(pod.basePath, entityId);
    await engine.sync.now();

    await expect(engine.get("event", entityId)).resolves.toBeNull();
    const deletedState = await engine.sync.state();

    expect(deletedState).toMatchObject({
      status: "pending",
      configured: true,
    });
    expect(deletedState.pendingChanges).toBeGreaterThan(0);

    await engine.sync.now();

    await expect(engine.sync.state()).resolves.toMatchObject({
      status: "idle",
      configured: true,
      pendingChanges: 0,
      connection: {
        reachable: true,
        lastSyncedAt: expect.any(String),
      },
    });
  }, 30_000);

  it("reconciles a compatible canonical update after attach and keeps local list usable", async () => {
    const runId = createRunId();
    const entityId = `ev-post-attach-${runId}`;
    const { engine, pod } = createSyncedEngine();

    await engine.save("event", {
      id: entityId,
      title: "Before external update",
      time: {
        year: 2026,
      },
    });
    await engine.sync.now();

    await deleteExternalCanonicalEvent(pod.basePath, entityId);
    await putExternalCanonicalEvent(
      pod.basePath,
      entityId,
      "After external update",
      2029,
    );
    await expect(readCanonicalBody(pod.basePath, entityId)).resolves.toContain(
      "After external update",
    );

    await engine.sync.now();

    await expect(engine.get("event", entityId)).resolves.toEqual({
      id: entityId,
      title: "After external update",
      time: {
        year: 2029,
      },
    });
    await expect(engine.list("event")).resolves.toContainEqual({
      id: entityId,
      title: "After external update",
      time: {
        year: 2029,
      },
    });

    await engine.sync.now();
    await expect(engine.sync.state()).resolves.toMatchObject({
      status: "idle",
      configured: true,
      pendingChanges: 0,
      connection: {
        reachable: true,
      },
    });
  }, 30_000);
});
