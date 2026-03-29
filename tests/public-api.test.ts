import { describe, expect, it } from "vitest";

import {
  createEngine,
  createMemoryStorage,
  defineVocabulary,
  packageVersion,
  rdf,
  type LocalChange,
  type LocalStorageAdapter,
  type LocalStorageTransaction,
  type Triple,
} from "../src/index.js";
import {
  createEventFixture,
  createEventWithDetailsFixture,
  type Event,
  type EventWithDetails,
} from "./support/eventFixture.js";
import { createNoteFixture, type Note } from "./support/noteFixture.js";
import { createTaggableNoteFixture } from "./support/taggableNoteFixture.js";

describe("public API scaffold", () => {
  it("exposes the initial package version", () => {
    expect(packageVersion).toBe("0.1.0");
  });

  it("provides standard RDF terms", () => {
    expect(rdf.type).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
  });
});

describe("defineVocabulary", () => {
  it("expands named terms against the base IRI", () => {
    const ex = defineVocabulary({
      base: "https://example.com/",
      terms: {
        Event: "ns#Event",
        title: "ns#title",
      },
      uri({ base, entityName, id }) {
        return `${base}id/${entityName}/${id}`;
      },
    });

    expect(ex.Event).toBe("https://example.com/ns#Event");
    expect(ex.title).toBe("https://example.com/ns#title");
  });

  it("binds the base IRI into the vocabulary uri factory", () => {
    const ex = defineVocabulary({
      base: "https://example.com/",
      terms: {
        Event: "ns#Event",
      },
      uri({ base, entityName, id }) {
        return `${base}id/${entityName}/${id}`;
      },
    });

    expect(ex.uri({ entityName: "event", id: "ev-123" })).toBe(
      "https://example.com/id/event/ev-123",
    );
  });
});

describe("defineEntity", () => {
  it("keeps entity configuration together with pure RDF projection logic", () => {
    const { entity } = createEventFixture();

    expect(entity.name).toBe("event");
    expect(entity.pod.basePath).toBe("events/");
    expect(entity.rdfType).toBe("https://example.com/ns#Event");
  });

  it("supports path-based child nodes for embedded one-to-one structures", () => {
    const { entity } = createEventFixture();
    const event = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    const graph = entity.toRdf(event, {
      uri(currentEvent) {
        return entity.uri?.(currentEvent) ?? "";
      },
      child(path: string) {
        return `child:${path}`;
      },
    });

    expect(graph).toEqual<Triple[]>([
      [
        "https://example.com/id/event/ev-123",
        rdf.type,
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
        "child:time",
      ],
      ["child:time", "https://example.com/ns#year", 2024],
    ]);

    const projected = entity.project(graph, {
      uri() {
        return "https://example.com/id/event/ev-123";
      },
      child(path: string) {
        return `child:${path}`;
      },
    });

    expect(projected).toEqual(event);
  });

  it("supports flat scalar entities without embedded child nodes", () => {
    const { entity } = createNoteFixture();
    const note = {
      id: "note-1",
      title: "Hello",
      body: "World",
    };

    const graph = entity.toRdf(note, {
      uri(currentNote) {
        return entity.uri?.(currentNote) ?? "";
      },
      child(path: string) {
        return `unused:${path}`;
      },
    });

    expect(graph).toEqual<Triple[]>([
      [
        "https://example.com/id/note/note-1",
        rdf.type,
        "https://example.com/ns#Note",
      ],
      [
        "https://example.com/id/note/note-1",
        "https://example.com/ns#title",
        "Hello",
      ],
      [
        "https://example.com/id/note/note-1",
        "https://example.com/ns#body",
        "World",
      ],
    ]);

    expect(
      entity.project(graph, {
        uri() {
          return "https://example.com/id/note/note-1";
        },
        child(path: string) {
          return `unused:${path}`;
        },
      }),
    ).toEqual(note);
  });

  it("supports unordered collection properties", () => {
    const { entity } = createTaggableNoteFixture();
    const note = {
      id: "note-1",
      title: "Hello",
      tags: ["zeta", "alpha"],
    };

    const graph = entity.toRdf(note, {
      uri(currentNote) {
        return entity.uri?.(currentNote) ?? "";
      },
      child(path: string) {
        return `unused:${path}`;
      },
    });

    expect(graph).toEqual<Triple[]>([
      [
        "https://example.com/id/taggable-note/note-1",
        rdf.type,
        "https://example.com/ns#Note",
      ],
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#title",
        "Hello",
      ],
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#tag",
        "alpha",
      ],
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#tag",
        "zeta",
      ],
    ]);

    expect(
      entity.project(graph, {
        uri() {
          return "https://example.com/id/taggable-note/note-1";
        },
        child(path: string) {
          return `unused:${path}`;
        },
      }),
    ).toEqual({
      id: "note-1",
      title: "Hello",
      tags: ["alpha", "zeta"],
    });
  });
});

describe("createEngine", () => {
  it("saves one entity and reads it back through the public API", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    const input = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    await engine.save("event", input);

    await expect(engine.get("event", "ev-123")).resolves.toEqual(input);
  });

  it("overwrites an entity by replacing its canonical graph", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await engine.save("event", {
      id: "ev-123",
      title: "First",
      time: {
        year: 2024,
      },
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });

    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });
  });

  it("returns null when an entity is not present", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await expect(engine.get("event", "missing")).resolves.toBeNull();
  });

  it("saves and reads back a flat scalar entity", async () => {
    const { entity } = createNoteFixture();
    const engine = createEngine({
      entities: [entity],
    });

    const input: Note = {
      id: "note-1",
      title: "Hello",
      body: "World",
    };

    await engine.save("note", input);

    await expect(engine.get("note", "note-1")).resolves.toEqual(input);
  });

  it("saves and reads back an entity with an unordered collection", async () => {
    const { entity } = createTaggableNoteFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await engine.save("taggable-note", {
      id: "note-1",
      title: "Hello",
      tags: ["zeta", "alpha"],
    });

    await expect(engine.get("taggable-note", "note-1")).resolves.toEqual({
      id: "note-1",
      title: "Hello",
      tags: ["alpha", "zeta"],
    });
  });
});

describe("local persistence", () => {
  it("persists the canonical graph, projection, and local change log", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    const input: Event = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    await engine.save("event", input);

    const stored = await storage.readEntity("event", "ev-123");
    const changes = await storage.listChanges("event", "ev-123");

    expect(stored?.projection).toEqual(input);
    expect(stored?.graph).toHaveLength(4);
    expect(stored?.lastChangeId).toBeTypeOf("string");
    expect(stored?.rootUri).toBe("https://example.com/id/event/ev-123");
    expect(changes).toHaveLength(1);
    expect(changes[0]?.assertions).toHaveLength(4);
    expect(changes[0]?.retractions).toHaveLength(0);
  });

  it("survives engine recreation with the same storage adapter", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();

    const firstEngine = createEngine({
      entities: [entity],
      storage,
    });

    const input: Event = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    await firstEngine.save("event", input);

    const secondEngine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual(input);
  });

  it("returns defensive copies from memory storage reads", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
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
      throw new Error("missing record");
    }

    stored.graph[0]![0] = "https://example.com/id/event/mutated";
    (stored.projection as Event).title = "Mutated";

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

  it("rehydrates an entity from stored graph state even if the stored projection is stale", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();

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

    await storage.transact((transaction) => {
      const record = transaction.readEntity("event", "ev-123");

      if (!record) {
        throw new Error("missing record");
      }

      transaction.writeEntity("event", "ev-123", {
        ...record,
        projection: {
          id: "ev-123",
          title: "STALE",
          time: {
            year: 1900,
          },
        },
      });
    });

    const secondEngine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
  });

  it("repairs the stored projection from graph state during get", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
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

    await storage.transact((transaction) => {
      const record = transaction.readEntity("event", "ev-123");

      if (!record) {
        throw new Error("missing record");
      }

      transaction.writeEntity("event", "ev-123", {
        ...record,
        projection: null,
      });
    });

    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    await expect(storage.readEntity("event", "ev-123")).resolves.toMatchObject({
      projection: {
        id: "ev-123",
        title: "Hello",
        time: {
          year: 2024,
        },
      },
    });
  });

  it("rolls back local writes when a storage transaction fails", async () => {
    const { entity } = createEventFixture();

    const state = {
      records: new Map<
        string,
        {
          rootUri: string;
          graph: Triple[];
          projection: unknown;
          lastChangeId: string | null;
          updatedOrder: number;
        }
      >(),
      changes: [] as LocalChange[],
      syncMetadata: {
        observedRemoteChangeIds: [] as string[],
      },
      updatedOrder: 0,
    };

    const cloneState = () => ({
      records: new Map(
        Array.from(state.records.entries(), ([key, value]) => [
          key,
          {
            rootUri: value.rootUri,
            graph: [...value.graph],
            projection: value.projection,
            lastChangeId: value.lastChangeId,
            updatedOrder: value.updatedOrder,
          },
        ]),
      ),
      changes: state.changes.map((change) => ({
        ...change,
        assertions: [...change.assertions],
        retractions: [...change.retractions],
      })),
      syncMetadata: {
        observedRemoteChangeIds: [
          ...state.syncMetadata.observedRemoteChangeIds,
        ],
      },
      updatedOrder: state.updatedOrder,
    });

    const failingStorage: LocalStorageAdapter = {
      async readEntity(entityName, entityId) {
        return state.records.get(`${entityName}:${entityId}`) ?? null;
      },
      async listEntities() {
        return [];
      },
      async listChanges(entityName, entityId) {
        return state.changes.filter(
          (change) =>
            (entityName ? change.entityName === entityName : true) &&
            (entityId ? change.entityId === entityId : true),
        );
      },
      async readSyncMetadata() {
        return {
          observedRemoteChangeIds: [
            ...state.syncMetadata.observedRemoteChangeIds,
          ],
        };
      },
      async transact<T>(
        work: (transaction: LocalStorageTransaction) => Promise<T> | T,
      ): Promise<T> {
        const draft = cloneState();
        const transaction: LocalStorageTransaction = {
          readEntity(entityName, entityId) {
            return draft.records.get(`${entityName}:${entityId}`) ?? null;
          },
          writeEntity(entityName, entityId, record) {
            draft.records.set(`${entityName}:${entityId}`, record);
          },
          appendChange() {
            throw new Error("append failed");
          },
          markChangeEntityProjected() {
            // no-op in the failing transaction stub
          },
          markChangeLogProjected() {
            // no-op in the failing transaction stub
          },
          readSyncMetadata() {
            return {
              observedRemoteChangeIds: [
                ...draft.syncMetadata.observedRemoteChangeIds,
              ],
            };
          },
          writeSyncMetadata(metadata) {
            draft.syncMetadata = {
              observedRemoteChangeIds: [...metadata.observedRemoteChangeIds],
            };
          },
          nextUpdatedOrder() {
            draft.updatedOrder += 1;
            return draft.updatedOrder;
          },
        };

        return work(transaction);
      },
    };

    const engine = createEngine({
      entities: [entity],
      storage: failingStorage,
    });

    await expect(
      engine.save("event", {
        id: "ev-123",
        title: "Hello",
        time: {
          year: 2024,
        },
      }),
    ).rejects.toThrow("append failed");

    await expect(
      failingStorage.readEntity("event", "ev-123"),
    ).resolves.toBeNull();
    await expect(
      failingStorage.listChanges("event", "ev-123"),
    ).resolves.toEqual([]);
  });
});

describe("graph deltas", () => {
  it("records one retraction and one assertion when a literal value changes", async () => {
    const { entity } = createEventWithDetailsFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-123",
      title: "First",
      time: {
        year: 2024,
      },
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2024,
      },
    });

    const changes = await storage.listChanges("event", "ev-123");
    const latest = changes.at(-1);

    expect(latest?.assertions).toEqual([
      [
        "https://example.com/id/event/ev-123",
        "https://example.com/ns#title",
        "Updated",
      ],
    ]);
    expect(latest?.retractions).toEqual([
      [
        "https://example.com/id/event/ev-123",
        "https://example.com/ns#title",
        "First",
      ],
    ]);
  });

  it("records embedded structure updates using the stable child node", async () => {
    const { entity } = createEventWithDetailsFixture();
    const storage = createMemoryStorage();
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

    await engine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2025,
      },
    });

    const changes = await storage.listChanges("event", "ev-123");
    const latest = changes.at(-1);

    expect(latest?.assertions).toEqual([
      [
        "https://example.com/id/event/ev-123#time",
        "https://example.com/ns#year",
        2025,
      ],
    ]);
    expect(latest?.retractions).toEqual([
      [
        "https://example.com/id/event/ev-123#time",
        "https://example.com/ns#year",
        2024,
      ],
    ]);
  });

  it("retracts deleted properties per triple", async () => {
    const { entity } = createEventWithDetailsFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Hello",
      description: "Soon",
      time: {
        year: 2024,
      },
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    const changes = await storage.listChanges("event", "ev-123");
    const latest = changes.at(-1);

    expect(latest?.assertions).toEqual([]);
    expect(latest?.retractions).toEqual([
      [
        "https://example.com/id/event/ev-123",
        "https://example.com/ns#description",
        "Soon",
      ],
    ]);
  });

  it("does not append a new change when the canonical graph is unchanged", async () => {
    const { entity } = createEventWithDetailsFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    const event: EventWithDetails = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    await engine.save("event", event);
    await engine.save("event", event);

    await expect(storage.listChanges("event", "ev-123")).resolves.toHaveLength(
      1,
    );
  });

  it("records scalar changes for flat entities", async () => {
    const { entity } = createNoteFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("note", {
      id: "note-1",
      title: "Hello",
      body: "World",
    });

    await engine.save("note", {
      id: "note-1",
      title: "Hello",
      body: "Updated",
    });

    const changes = await storage.listChanges("note", "note-1");

    expect(changes.at(-1)).toMatchObject({
      assertions: [
        [
          "https://example.com/id/note/note-1",
          "https://example.com/ns#body",
          "Updated",
        ],
      ],
      retractions: [
        [
          "https://example.com/id/note/note-1",
          "https://example.com/ns#body",
          "World",
        ],
      ],
    });
  });

  it("treats unordered collections as set-like values", async () => {
    const { entity } = createTaggableNoteFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("taggable-note", {
      id: "note-1",
      title: "Hello",
      tags: ["alpha"],
    });

    await engine.save("taggable-note", {
      id: "note-1",
      title: "Hello",
      tags: ["alpha", "beta"],
    });

    const addChange = (await storage.listChanges("taggable-note", "note-1")).at(
      -1,
    );

    expect(addChange?.assertions).toEqual([
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#tag",
        "beta",
      ],
    ]);
    expect(addChange?.retractions).toEqual([]);

    await engine.save("taggable-note", {
      id: "note-1",
      title: "Hello",
      tags: ["beta"],
    });

    const removeChange = (
      await storage.listChanges("taggable-note", "note-1")
    ).at(-1);

    expect(removeChange?.assertions).toEqual([]);
    expect(removeChange?.retractions).toEqual([
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#tag",
        "alpha",
      ],
    ]);
  });
});

describe("list", () => {
  it("lists saved entities from newest to oldest", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: { year: 2024 },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: { year: 2025 },
    });

    await expect(engine.list("event")).resolves.toEqual([
      {
        id: "ev-2",
        title: "Second",
        time: { year: 2025 },
      },
      {
        id: "ev-1",
        title: "First",
        time: { year: 2024 },
      },
    ]);
  });

  it("supports a basic limit option", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: { year: 2024 },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: { year: 2025 },
    });

    await expect(engine.list("event", { limit: 1 })).resolves.toEqual([
      {
        id: "ev-2",
        title: "Second",
        time: { year: 2025 },
      },
    ]);
  });

  it("moves an updated entity to the front of the list", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: { year: 2024 },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: { year: 2025 },
    });
    await engine.save("event", {
      id: "ev-1",
      title: "First updated",
      time: { year: 2026 },
    });

    await expect(engine.list("event")).resolves.toEqual([
      {
        id: "ev-1",
        title: "First updated",
        time: { year: 2026 },
      },
      {
        id: "ev-2",
        title: "Second",
        time: { year: 2025 },
      },
    ]);
  });

  it("uses graph-based rehydration for listed entities after stale projection repair", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-1",
      title: "First",
      time: { year: 2024 },
    });
    await engine.save("event", {
      id: "ev-2",
      title: "Second",
      time: { year: 2025 },
    });

    await storage.transact((transaction) => {
      const record = transaction.readEntity("event", "ev-1");

      if (!record) {
        throw new Error("missing record");
      }

      transaction.writeEntity("event", "ev-1", {
        ...record,
        projection: {
          id: "ev-1",
          title: "STALE",
          time: { year: 1900 },
        },
      });
    });

    const restarted = createEngine({
      entities: [entity],
      storage,
    });

    await expect(restarted.list("event")).resolves.toEqual([
      {
        id: "ev-2",
        title: "Second",
        time: { year: 2025 },
      },
      {
        id: "ev-1",
        title: "First",
        time: { year: 2024 },
      },
    ]);
  });
});

describe("sync state", () => {
  const pod = {
    logBasePath: "apps/my-journal/log/",
  };

  it("reports when sync is not configured", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await expect(engine.sync.state()).resolves.toEqual({
      status: "unconfigured",
      configured: false,
      pendingChanges: 0,
    });
  });

  it("reports pending local changes when sync is configured", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            // no-op
          },
          async appendLogEntry() {
            // no-op
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

    await expect(engine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });
  });

  it("preserves pending change count across restart", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();

    const firstEngine = createEngine({
      entities: [entity],
      storage,
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            // no-op
          },
          async appendLogEntry() {
            // no-op
          },
        },
      },
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
      storage,
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            // no-op
          },
          async appendLogEntry() {
            // no-op
          },
        },
      },
    });

    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });
  });

  it("reports idle when sync is configured and there are no pending local changes", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            // no-op
          },
          async appendLogEntry() {
            // no-op
          },
        },
      },
    });

    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("becomes idle after pending changes are projected to canonical entity files", async () => {
    const { entity } = createEventFixture();
    const applied: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch(request) {
            applied.push(request.path);
          },
          async appendLogEntry() {
            // no-op
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

    expect(applied).toEqual(["events/ev-123.ttl"]);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("requires pod logBasePath before projecting remote log entries", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      sync: {
        adapter: {
          async applyEntityPatch() {
            // no-op
          },
          async appendLogEntry() {
            // no-op
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

    await expect(engine.sync.now()).rejects.toThrow(
      "Pod logBasePath is required for remote log projection.",
    );
  });
});

describe("mocked entity sync", () => {
  const pod = {
    logBasePath: "apps/my-journal/log/",
  };
  const createSharedRemoteAdapter = () => {
    const logEntries: Array<{
      entityName: string;
      entityId: string;
      changeId: string;
      parentChangeId: string | null;
      path: string;
      rootUri: string;
      assertions: Triple[];
      retractions: Triple[];
    }> = [];
    const canonicalEntities: Array<{
      entityName: string;
      entityId: string;
      path: string;
      rootUri: string;
      rdfType: string;
      graph: Triple[];
    }> = [];

    return {
      adapter: {
        async applyEntityPatch() {
          // no-op for mocked canonical file writes in pull tests
        },
        async appendLogEntry(request: {
          entityName: string;
          entityId: string;
          changeId: string;
          parentChangeId: string | null;
          path: string;
          rootUri: string;
          assertions: Triple[];
          retractions: Triple[];
        }) {
          logEntries.push({
            ...request,
            assertions: [...request.assertions],
            retractions: [...request.retractions],
          });
        },
        async listLogEntries() {
          return logEntries.map((entry) => ({
            ...entry,
            assertions: [...entry.assertions],
            retractions: [...entry.retractions],
          }));
        },
        async listCanonicalEntities(input: {
          entityName: string;
          basePath: string;
          rdfType: string;
        }) {
          return canonicalEntities
            .filter(
              (entity) =>
                entity.entityName === input.entityName &&
                entity.path.startsWith(input.basePath) &&
                entity.rdfType === input.rdfType,
            )
            .map((entity) => ({
              entityId: entity.entityId,
              path: entity.path,
              rootUri: entity.rootUri,
              graph: [...entity.graph],
            }));
        },
      },
      logEntries,
      canonicalEntities,
    };
  };

  it("projects local changes into canonical entity file patches", async () => {
    const { entity } = createEventFixture();
    const requests: Array<{
      path: string;
      patch: string;
      rootUri: string;
    }> = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch(request) {
            requests.push({
              path: request.path,
              patch: request.patch,
              rootUri: request.rootUri,
            });
          },
          async appendLogEntry() {
            // no-op
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

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      path: "events/ev-123.ttl",
      rootUri: "https://example.com/id/event/ev-123",
    });
    expect(requests[0]?.patch).toContain("solid:InsertDeletePatch");
    expect(requests[0]?.patch).toContain("solid:inserts {");
    expect(requests[0]?.patch).toContain(
      '<https://example.com/id/event/ev-123> <https://example.com/ns#title> "Hello" .',
    );
  });

  it("retries entity file projection until it succeeds", async () => {
    const { entity } = createEventFixture();
    let attempts = 0;
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            attempts += 1;

            if (attempts === 1) {
              throw new Error("temporary failure");
            }
          },
          async appendLogEntry() {
            // no-op
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

    await expect(engine.sync.now()).rejects.toThrow("temporary failure");
    await expect(engine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });

    await expect(engine.sync.now()).resolves.toBeUndefined();
    expect(attempts).toBe(2);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("includes embedded child-node updates in later patches", async () => {
    const { entity } = createEventFixture();
    const patches: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch(request) {
            patches.push(request.patch);
          },
          async appendLogEntry() {
            // no-op
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

    await engine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2025,
      },
    });
    await engine.sync.now();

    expect(patches).toHaveLength(2);
    expect(patches[1]).toContain("solid:deletes {");
    expect(patches[1]).toContain(
      "<https://example.com/id/event/ev-123#time> <https://example.com/ns#year> 2024 .",
    );
    expect(patches[1]).toContain("solid:inserts {");
    expect(patches[1]).toContain(
      "<https://example.com/id/event/ev-123#time> <https://example.com/ns#year> 2025 .",
    );
  });

  it("appends a replication log entry after entity file projection", async () => {
    const { entity } = createEventFixture();
    const calls: string[] = [];
    const logRequests: Array<{
      path: string;
      assertions: Triple[];
      retractions: Triple[];
    }> = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            calls.push("entity");
          },
          async appendLogEntry(request) {
            calls.push("log");
            logRequests.push({
              path: request.path,
              assertions: request.assertions,
              retractions: request.retractions,
            });
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

    expect(calls).toEqual(["entity", "log"]);
    expect(logRequests).toHaveLength(1);
    expect(logRequests[0]?.path).toContain("apps/my-journal/log/event/");
    expect(logRequests[0]?.assertions).toHaveLength(4);
    expect(logRequests[0]?.retractions).toHaveLength(0);
  });

  it("retries remote log append independently after entity projection succeeded", async () => {
    const { entity } = createEventFixture();
    let patchAttempts = 0;
    let logAttempts = 0;
    const engine = createEngine({
      entities: [entity],
      pod,
      sync: {
        adapter: {
          async applyEntityPatch() {
            patchAttempts += 1;
          },
          async appendLogEntry() {
            logAttempts += 1;

            if (logAttempts === 1) {
              throw new Error("log failure");
            }
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

    await expect(engine.sync.now()).rejects.toThrow("log failure");
    expect(patchAttempts).toBe(1);
    expect(logAttempts).toBe(1);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });

    await expect(engine.sync.now()).resolves.toBeUndefined();
    expect(patchAttempts).toBe(1);
    expect(logAttempts).toBe(2);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("replays remote log entries into local graph state on another engine", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    const firstEngine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });
    const secondStorage = createMemoryStorage();
    const secondEngine = createEngine({
      entities: [entity],
      pod,
      storage: secondStorage,
      sync: {
        adapter: remote.adapter,
      },
    });

    await firstEngine.save("event", {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();

    await expect(secondEngine.get("event", "ev-123")).resolves.toBeNull();

    await secondEngine.sync.now();

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await expect(
      secondStorage.listChanges("event", "ev-123"),
    ).resolves.toHaveLength(1);
    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("applies later remote updates and tolerates duplicate remote log entries", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    const firstEngine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });
    const secondStorage = createMemoryStorage();
    const secondEngine = createEngine({
      entities: [entity],
      pod,
      storage: secondStorage,
      sync: {
        adapter: remote.adapter,
      },
    });

    await firstEngine.save("event", {
      id: "ev-123",
      title: "First",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    await firstEngine.save("event", {
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();
    await secondEngine.sync.now();

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });
    await expect(secondEngine.list("event")).resolves.toEqual([
      {
        id: "ev-123",
        title: "Updated",
        time: {
          year: 2025,
        },
      },
    ]);
    await expect(
      secondStorage.listChanges("event", "ev-123"),
    ).resolves.toHaveLength(2);
  });

  it("bootstraps missing local entities from canonical remote resources", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    remote.canonicalEntities.push({
      entityName: "event",
      entityId: "ev-remote",
      path: "events/ev-remote.ttl",
      rootUri: "https://example.com/id/event/ev-remote",
      rdfType: entity.rdfType,
      graph: [
        [
          "https://example.com/id/event/ev-remote",
          rdf.type,
          "https://example.com/ns#Event",
        ],
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#title",
          "Remote",
        ],
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#time",
          "https://example.com/id/event/ev-remote#time",
        ],
        [
          "https://example.com/id/event/ev-remote#time",
          "https://example.com/ns#year",
          2024,
        ],
      ],
    });
    const engine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });

    await expect(engine.sync.bootstrap()).resolves.toEqual({
      imported: 1,
      skipped: 0,
      collisions: [],
    });
    await expect(engine.get("event", "ev-remote")).resolves.toEqual({
      id: "ev-remote",
      title: "Remote",
      time: {
        year: 2024,
      },
    });
  });

  it("skips replay of older remote log entries already observed during bootstrap", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    remote.canonicalEntities.push({
      entityName: "event",
      entityId: "ev-remote",
      path: "events/ev-remote.ttl",
      rootUri: "https://example.com/id/event/ev-remote",
      rdfType: entity.rdfType,
      graph: [
        [
          "https://example.com/id/event/ev-remote",
          rdf.type,
          "https://example.com/ns#Event",
        ],
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#title",
          "Remote",
        ],
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#time",
          "https://example.com/id/event/ev-remote#time",
        ],
        [
          "https://example.com/id/event/ev-remote#time",
          "https://example.com/ns#year",
          2024,
        ],
      ],
    });
    remote.logEntries.push({
      entityName: "event",
      entityId: "ev-remote",
      changeId: "remote-1",
      parentChangeId: null,
      path: "apps/my-journal/log/event/remote-1.ttl",
      rootUri: "https://example.com/id/event/ev-remote",
      assertions: [
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#title",
          "Historical",
        ],
      ],
      retractions: [
        [
          "https://example.com/id/event/ev-remote",
          "https://example.com/ns#title",
          "Remote",
        ],
      ],
    });
    const engine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });

    await engine.sync.bootstrap();
    await engine.sync.now();

    await expect(engine.get("event", "ev-remote")).resolves.toEqual({
      id: "ev-remote",
      title: "Remote",
      time: {
        year: 2024,
      },
    });
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("reports collisions instead of overwriting differing local entities during bootstrap", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    remote.canonicalEntities.push({
      entityName: "event",
      entityId: "ev-123",
      path: "events/ev-123.ttl",
      rootUri: "https://example.com/id/event/ev-123",
      rdfType: entity.rdfType,
      graph: [
        [
          "https://example.com/id/event/ev-123",
          rdf.type,
          "https://example.com/ns#Event",
        ],
        [
          "https://example.com/id/event/ev-123",
          "https://example.com/ns#title",
          "Remote title",
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
    });
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      pod,
      storage,
      sync: {
        adapter: remote.adapter,
      },
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Local title",
      time: {
        year: 2025,
      },
    });

    await expect(engine.sync.bootstrap()).resolves.toEqual({
      imported: 0,
      skipped: 0,
      collisions: [
        {
          entityName: "event",
          entityId: "ev-123",
          path: "events/ev-123.ttl",
        },
      ],
    });
    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Local title",
      time: {
        year: 2025,
      },
    });
    await expect(storage.listChanges("event", "ev-123")).resolves.toHaveLength(
      1,
    );
  });
});
