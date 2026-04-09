import { describe, expect, it, vi } from "vitest";

import {
  createEngine,
  createMemoryStorage,
  detectForks,
  defineEntity,
  defineVocabulary,
  numberValue,
  rdf,
  stringValue,
  uri,
  type LocalChange,
  type LocalStorageAdapter,
  type LocalStorageTransaction,
  type EntityDefinition,
  type PodEntityPatchRequest,
  type Triple,
  type SyncMetadata,
} from "../src/index.js";
import {
  createEventFixture,
  createEventWithDetailsFixture,
  type Event,
  type EventWithDetails,
} from "./support/eventFixture.js";
import { createNoteFixture, type Note } from "./support/noteFixture.js";
import { createTaggableNoteFixture } from "./support/taggableNoteFixture.js";

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function comparableTerm(term: Triple[number]): string | number | boolean {
  if (
    typeof term === "string" ||
    typeof term === "number" ||
    typeof term === "boolean"
  ) {
    return term;
  }

  return term.value;
}

function comparableTriples(triples: Triple[]) {
  return triples.map(([subject, predicate, object]) => [
    comparableTerm(subject),
    comparableTerm(predicate),
    comparableTerm(object),
  ]);
}

function tripleKey(triple: Triple): string {
  return JSON.stringify([
    comparableTerm(triple[0]),
    comparableTerm(triple[1]),
    comparableTerm(triple[2]),
  ]);
}

function applyPublicTripleDelta(
  current: Triple[],
  input: {
    assertions: Triple[];
    retractions: Triple[];
  },
): Triple[] {
  const next = new Map(current.map((triple) => [tripleKey(triple), triple]));

  for (const triple of input.retractions) {
    next.delete(tripleKey(triple));
  }

  for (const triple of input.assertions) {
    next.set(tripleKey(triple), triple);
  }

  return Array.from(next.values());
}

function eventGraph(entityId: string, title: string, year: number): Triple[] {
  const subject = uri(`https://example.com/id/event/${entityId}`);
  const time = uri(`https://example.com/id/event/${entityId}#time`);

  return [
    [
      subject,
      uri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      uri("https://example.com/ns#Event"),
    ],
    [subject, uri("https://example.com/ns#title"), title],
    [subject, uri("https://example.com/ns#time"), time],
    [time, uri("https://example.com/ns#year"), year],
  ] satisfies Triple[];
}

function createRecanonicalizedEventFixtures(): {
  legacyEntity: EntityDefinition<Event>;
  currentEntity: EntityDefinition<Event>;
  aliasPredicate: ReturnType<typeof uri>;
} {
  const ex = defineVocabulary({
    base: "https://example.com/",
    terms: {
      Event: "ns#Event",
      title: "ns#title",
      titleAlias: "ns#titleAlias",
      time: "ns#time",
      year: "ns#year",
    },
    uri({ base, entityName, id }) {
      return `${base}id/${entityName}/${id}`;
    },
  });

  const project: EntityDefinition<Event>["project"] = (
    graph,
    { uri, child },
  ) => {
    const subject = uri();
    const time = child("time");

    return {
      id: subject.value.split("/").at(-1) ?? "",
      title: stringValue(graph, subject, ex.title),
      time: {
        year: numberValue(graph, time, ex.year),
      },
    };
  };

  const legacyEntity = defineEntity<Event>({
    name: "event",
    pod: {
      basePath: "events/",
    },
    rdfType: ex.Event,
    id: (event) => event.id,
    uri: (event) =>
      ex.uri({
        entityName: "event",
        id: event.id,
      }),
    toRdf(event, { uri, child }) {
      const subject = uri(event);
      const time = child("time");

      return [
        [subject, rdf.type, ex.Event],
        [subject, ex.title, event.title],
        [subject, ex.time, time],
        [time, ex.year, event.time.year],
      ];
    },
    project,
  });

  const currentEntity = defineEntity<Event>({
    ...legacyEntity,
    toRdf(event, { uri, child }) {
      const subject = uri(event);
      const time = child("time");

      return [
        [subject, rdf.type, ex.Event],
        [subject, ex.title, event.title],
        [subject, ex.titleAlias, event.title],
        [subject, ex.time, time],
        [time, ex.year, event.time.year],
      ];
    },
  });

  return {
    legacyEntity,
    currentEntity,
    aliasPredicate: ex.titleAlias,
  };
}

describe("public API scaffold", () => {
  it("provides standard RDF terms", () => {
    expect(rdf.type.value).toBe(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    );
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

    expect(ex.Event.value).toBe("https://example.com/ns#Event");
    expect(ex.title.value).toBe("https://example.com/ns#title");
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

    expect(ex.uri({ entityName: "event", id: "ev-123" }).value).toBe(
      "https://example.com/id/event/ev-123",
    );
  });
});

describe("defineEntity", () => {
  it("keeps entity configuration together with pure RDF projection logic", () => {
    const { entity } = createEventFixture();

    expect(entity.name).toBe("event");
    expect(entity.pod.basePath).toBe("events/");
    expect(entity.rdfType.value).toBe("https://example.com/ns#Event");
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
        return entity.uri?.(currentEvent) ?? uri("");
      },
      child(path: string) {
        return uri(`child:${path}`);
      },
    });

    expect(comparableTriples(graph)).toEqual([
      [
        "https://example.com/id/event/ev-123",
        rdf.type.value,
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
        return uri("https://example.com/id/event/ev-123");
      },
      child(path: string) {
        return uri(`child:${path}`);
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
        return entity.uri?.(currentNote) ?? uri("");
      },
      child(path: string) {
        return uri(`unused:${path}`);
      },
    });

    expect(comparableTriples(graph)).toEqual([
      [
        "https://example.com/id/note/note-1",
        rdf.type.value,
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
          return uri("https://example.com/id/note/note-1");
        },
        child(path: string) {
          return uri(`unused:${path}`);
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
        return entity.uri?.(currentNote) ?? uri("");
      },
      child(path: string) {
        return uri(`unused:${path}`);
      },
    });

    expect(comparableTriples(graph)).toEqual([
      [
        "https://example.com/id/taggable-note/note-1",
        rdf.type.value,
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
          return uri("https://example.com/id/taggable-note/note-1");
        },
        child(path: string) {
          return uri(`unused:${path}`);
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
    expect(changes[0]?.timestamp).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(changes[0]?.assertions).toHaveLength(4);
    expect(changes[0]?.retractions).toHaveLength(0);
  });

  it("generates unique change IDs across rapid saves", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    for (let year = 2020; year < 2030; year += 1) {
      await engine.save("event", {
        id: "ev-rapid",
        title: `Version ${year}`,
        time: {
          year,
        },
      });
    }

    const changeIds = (await storage.listChanges("event", "ev-rapid")).map(
      (change) => change.changeId,
    );

    expect(changeIds).toHaveLength(10);
    expect(new Set(changeIds).size).toBe(changeIds.length);
    expect(changeIds.every((changeId) => typeof changeId === "string")).toBe(
      true,
    );
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

  it("deletes a saved entity and removes it from reads, lists, and the local log state", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.save("event", {
      id: "ev-delete",
      title: "Gone",
      time: {
        year: 2024,
      },
    });

    await engine.delete("event", "ev-delete");

    await expect(engine.get("event", "ev-delete")).resolves.toBeNull();
    await expect(engine.list("event")).resolves.toEqual([]);

    const changes = await storage.listChanges("event", "ev-delete");
    const deletion = changes.at(-1);

    expect(changes).toHaveLength(2);
    expect(deletion?.assertions).toEqual([]);
    expect(deletion?.retractions).toHaveLength(4);
    await expect(storage.readEntity("event", "ev-delete")).resolves.toBeNull();
  });

  it("ignores deletion of a non-existent entity", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(engine.delete("event", "missing")).resolves.toBeUndefined();
    await expect(storage.listChanges("event", "missing")).resolves.toEqual([]);
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

    stored.graph[0]![0] = uri("https://example.com/id/event/mutated");
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

  it("re-canonicalizes the stored graph when the current entity definition adds triples", async () => {
    const { legacyEntity, currentEntity, aliasPredicate } =
      createRecanonicalizedEventFixtures();
    const storage = createMemoryStorage();

    const firstEngine = createEngine({
      entities: [legacyEntity],
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
      entities: [currentEntity],
      storage,
    });

    await expect(secondEngine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    const stored = await storage.readEntity("event", "ev-123");
    const changes = await storage.listChanges("event", "ev-123");
    const repairChange = changes.at(-1);

    expect(stored?.graph).toHaveLength(5);
    expect(
      stored?.graph.some(
        ([subject, predicate, object]) =>
          subject.value === "https://example.com/id/event/ev-123" &&
          predicate.value === aliasPredicate.value &&
          object === "Hello",
      ),
    ).toBe(true);
    expect(changes).toHaveLength(2);
    expect(repairChange?.assertions).toHaveLength(1);
    expect(repairChange?.assertions[0]?.[1].value).toBe(aliasPredicate.value);
    expect(repairChange?.retractions).toEqual([]);
  });

  it("does not emit repeated graph repairs once the stored entity has been re-canonicalized", async () => {
    const { legacyEntity, currentEntity } =
      createRecanonicalizedEventFixtures();
    const storage = createMemoryStorage();

    const firstEngine = createEngine({
      entities: [legacyEntity],
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
      entities: [currentEntity],
      storage,
    });

    await secondEngine.get("event", "ev-123");
    const afterFirstGet = await storage.listChanges("event", "ev-123");

    await secondEngine.get("event", "ev-123");
    const afterSecondGet = await storage.listChanges("event", "ev-123");

    expect(afterFirstGet).toHaveLength(2);
    expect(afterSecondGet).toHaveLength(2);
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
        persistedPodConfig: null,
        canonicalContainerVersions: {},
      } as SyncMetadata,
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
        persistedPodConfig: state.syncMetadata.persistedPodConfig
          ? {
              ...state.syncMetadata.persistedPodConfig,
            }
          : null,
        canonicalContainerVersions: {
          ...state.syncMetadata.canonicalContainerVersions,
        },
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
          persistedPodConfig: state.syncMetadata.persistedPodConfig
            ? {
                ...state.syncMetadata.persistedPodConfig,
              }
            : null,
          canonicalContainerVersions: {
            ...state.syncMetadata.canonicalContainerVersions,
          },
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
          removeEntity(entityName, entityId) {
            draft.records.delete(`${entityName}:${entityId}`);
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
              persistedPodConfig: draft.syncMetadata.persistedPodConfig
                ? {
                    ...draft.syncMetadata.persistedPodConfig,
                  }
                : null,
              canonicalContainerVersions: {
                ...draft.syncMetadata.canonicalContainerVersions,
              },
            };
          },
          writeSyncMetadata(metadata) {
            draft.syncMetadata = {
              observedRemoteChangeIds: [...metadata.observedRemoteChangeIds],
              persistedPodConfig: metadata.persistedPodConfig
                ? {
                    ...metadata.persistedPodConfig,
                  }
                : null,
              canonicalContainerVersions: {
                ...metadata.canonicalContainerVersions,
              },
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

    expect(comparableTriples(latest?.assertions ?? [])).toEqual([
      [
        "https://example.com/id/event/ev-123",
        "https://example.com/ns#title",
        "Updated",
      ],
    ]);
    expect(comparableTriples(latest?.retractions ?? [])).toEqual([
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

    expect(comparableTriples(latest?.assertions ?? [])).toEqual([
      [
        "https://example.com/id/event/ev-123#time",
        "https://example.com/ns#year",
        2025,
      ],
    ]);
    expect(comparableTriples(latest?.retractions ?? [])).toEqual([
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

    expect(comparableTriples(latest?.assertions ?? [])).toEqual([]);
    expect(comparableTriples(latest?.retractions ?? [])).toEqual([
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

    expect({
      ...changes.at(-1),
      assertions: comparableTriples(changes.at(-1)?.assertions ?? []),
      retractions: comparableTriples(changes.at(-1)?.retractions ?? []),
    }).toMatchObject({
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

    expect(comparableTriples(addChange?.assertions ?? [])).toEqual([
      [
        "https://example.com/id/taggable-note/note-1",
        "https://example.com/ns#tag",
        "beta",
      ],
    ]);
    expect(comparableTriples(addChange?.retractions ?? [])).toEqual([]);

    await engine.save("taggable-note", {
      id: "note-1",
      title: "Hello",
      tags: ["beta"],
    });

    const removeChange = (
      await storage.listChanges("taggable-note", "note-1")
    ).at(-1);

    expect(comparableTriples(removeChange?.assertions ?? [])).toEqual([]);
    expect(comparableTriples(removeChange?.retractions ?? [])).toEqual([
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

  it("reports a pending deletion before sync", async () => {
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
      id: "ev-delete",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await engine.delete("event", "ev-delete");

    await expect(engine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 2,
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

  it("attaches sync at runtime and exposes pending local changes", async () => {
    const { entity } = createEventFixture();
    const pushed: string[] = [];
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await engine.save("event", {
      id: "ev-attach",
      title: "Hello",
      time: {
        year: 2024,
      },
    });

    await expect(engine.sync.state()).resolves.toEqual({
      status: "unconfigured",
      configured: false,
      pendingChanges: 1,
    });

    await engine.sync.attach({
      adapter: {
        async applyEntityPatch(request: PodEntityPatchRequest) {
          pushed.push(request.path);
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod.example/",
      logBasePath: "apps/my-journal/log/",
    });

    await expect(engine.sync.persistedConfig()).resolves.toEqual({
      podBaseUrl: "https://pod.example/",
      logBasePath: "apps/my-journal/log/",
    });
    await expect(engine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });

    await engine.sync.now();

    expect(pushed).toEqual(["events/ev-attach.ttl"]);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("detaches sync, leaves new changes local-only, and can reattach later", async () => {
    const { entity } = createEventFixture();
    const firstAdapterPaths: string[] = [];
    const secondAdapterPaths: string[] = [];
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      storage,
    });

    await engine.sync.attach({
      adapter: {
        async applyEntityPatch(request: PodEntityPatchRequest) {
          firstAdapterPaths.push(request.path);
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod-one.example/",
      logBasePath: "apps/one/log/",
    });

    await engine.save("event", {
      id: "ev-detach-1",
      title: "First",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    await engine.sync.detach();
    await expect(engine.sync.persistedConfig()).resolves.toBeNull();
    await expect(engine.sync.state()).resolves.toEqual({
      status: "unconfigured",
      configured: false,
      pendingChanges: 0,
    });

    await engine.save("event", {
      id: "ev-detach-2",
      title: "Second",
      time: {
        year: 2025,
      },
    });

    await expect(engine.sync.state()).resolves.toEqual({
      status: "unconfigured",
      configured: false,
      pendingChanges: 1,
    });
    await expect(engine.sync.now()).resolves.toBeUndefined();

    await engine.sync.attach({
      adapter: {
        async applyEntityPatch(request: PodEntityPatchRequest) {
          secondAdapterPaths.push(request.path);
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod-two.example/",
      logBasePath: "apps/two/log/",
    });

    await expect(engine.sync.persistedConfig()).resolves.toEqual({
      podBaseUrl: "https://pod-two.example/",
      logBasePath: "apps/two/log/",
    });

    await engine.sync.now();

    expect(firstAdapterPaths).toEqual(["events/ev-detach-1.ttl"]);
    expect(secondAdapterPaths).toEqual(["events/ev-detach-2.ttl"]);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("replaces the current adapter when attaching again", async () => {
    const { entity } = createEventFixture();
    const firstAdapterPaths: string[] = [];
    const secondAdapterPaths: string[] = [];
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await engine.sync.attach({
      adapter: {
        async applyEntityPatch(request) {
          firstAdapterPaths.push(request.path);
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod-one.example/",
      logBasePath: "apps/one/log/",
    });

    await engine.sync.attach({
      adapter: {
        async applyEntityPatch(request) {
          secondAdapterPaths.push(request.path);
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod-two.example/",
      logBasePath: "apps/two/log/",
    });

    await engine.save("event", {
      id: "ev-switch",
      title: "Switched",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();

    expect(firstAdapterPaths).toEqual([]);
    expect(secondAdapterPaths).toEqual(["events/ev-switch.ttl"]);
    await expect(engine.sync.persistedConfig()).resolves.toEqual({
      podBaseUrl: "https://pod-two.example/",
      logBasePath: "apps/two/log/",
    });
  });

  it("persists attached pod config across engine recreation", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const firstEngine = createEngine({
      entities: [entity],
      storage,
    });

    await firstEngine.sync.attach({
      adapter: {
        async applyEntityPatch() {
          // no-op
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod.example/",
      logBasePath: "apps/my-journal/log/",
    });

    const secondEngine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(secondEngine.sync.persistedConfig()).resolves.toEqual({
      podBaseUrl: "https://pod.example/",
      logBasePath: "apps/my-journal/log/",
    });
    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "unconfigured",
      configured: false,
      pendingChanges: 0,
    });
  });

  it("clears persisted pod config across engine recreation after detach", async () => {
    const { entity } = createEventFixture();
    const storage = createMemoryStorage();
    const firstEngine = createEngine({
      entities: [entity],
      storage,
    });

    await firstEngine.sync.attach({
      adapter: {
        async applyEntityPatch() {
          // no-op
        },
        async appendLogEntry() {
          // no-op
        },
      },
      podBaseUrl: "https://pod.example/",
      logBasePath: "apps/my-journal/log/",
    });
    await firstEngine.sync.detach();

    const secondEngine = createEngine({
      entities: [entity],
      storage,
    });

    await expect(secondEngine.sync.persistedConfig()).resolves.toBeNull();
  });

  it("requires an attached adapter for bootstrap", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
      storage: createMemoryStorage(),
    });

    await expect(engine.sync.bootstrap()).rejects.toThrow(
      "Sync adapter is not attached.",
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
      timestamp: string;
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
      rdfType: ReturnType<typeof uri>;
      graph: Triple[];
    }> = [];
    const canonicalContainerVersions = new Map<string, string>();
    const canonicalChecks: string[] = [];
    let nextCanonicalVersion = 0;

    const bumpCanonicalVersion = (entityName: string) => {
      nextCanonicalVersion += 1;
      canonicalContainerVersions.set(entityName, `v${nextCanonicalVersion}`);
    };

    const upsertCanonicalEntity = (entity: {
      entityName: string;
      entityId: string;
      path: string;
      rootUri: string;
      rdfType: ReturnType<typeof uri>;
      graph: Triple[];
    }) => {
      const index = canonicalEntities.findIndex(
        (current) =>
          current.entityName === entity.entityName &&
          current.entityId === entity.entityId,
      );

      if (index >= 0) {
        canonicalEntities[index] = {
          ...entity,
          graph: [...entity.graph],
        };
      } else {
        canonicalEntities.push({
          ...entity,
          graph: [...entity.graph],
        });
      }

      bumpCanonicalVersion(entity.entityName);
    };

    const removeCanonicalEntity = (entityName: string, entityId: string) => {
      const index = canonicalEntities.findIndex(
        (entity) =>
          entity.entityName === entityName && entity.entityId === entityId,
      );

      if (index < 0) {
        return;
      }

      canonicalEntities.splice(index, 1);
      bumpCanonicalVersion(entityName);
    };

    return {
      adapter: {
        async applyEntityPatch(request: PodEntityPatchRequest) {
          const current = canonicalEntities.find(
            (entity) =>
              entity.entityName === request.entityName &&
              entity.entityId === request.entityId,
          );
          const rdfType =
            current?.rdfType ??
            ((request.assertions.find(
              ([, predicate, object]) =>
                predicate.value === rdf.type.value &&
                typeof object !== "string" &&
                typeof object !== "number" &&
                typeof object !== "boolean",
            )?.[2] ?? uri("https://example.com/ns#Unknown")) as ReturnType<
              typeof uri
            >);

          upsertCanonicalEntity({
            entityName: request.entityName,
            entityId: request.entityId,
            path: request.path,
            rootUri: request.rootUri,
            rdfType,
            graph: applyPublicTripleDelta(current?.graph ?? [], {
              assertions: request.assertions,
              retractions: request.retractions,
            }),
          });
        },
        async deleteEntityResource(request: {
          entityName: string;
          entityId: string;
        }) {
          removeCanonicalEntity(request.entityName, request.entityId);
        },
        async appendLogEntry(request: {
          entityName: string;
          entityId: string;
          changeId: string;
          parentChangeId: string | null;
          timestamp: string;
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
        async checkCanonicalResources(input: {
          entityName: string;
          basePath: string;
          rdfType: ReturnType<typeof uri>;
          previousVersion: string | null;
        }) {
          canonicalChecks.push(input.entityName);
          const version =
            canonicalContainerVersions.get(input.entityName) ?? null;

          if (version === input.previousVersion) {
            return {
              version,
              changed: false,
              entities: [],
            };
          }

          return {
            version,
            changed: true,
            entities: canonicalEntities
              .filter(
                (entity) =>
                  entity.entityName === input.entityName &&
                  entity.path.startsWith(input.basePath) &&
                  entity.rdfType.value === input.rdfType.value,
              )
              .map((entity) => ({
                entityId: entity.entityId,
                path: entity.path,
                rootUri: entity.rootUri,
                graph: [...entity.graph],
              })),
          };
        },
        async listCanonicalEntities(input: {
          entityName: string;
          basePath: string;
          rdfType: ReturnType<typeof uri>;
        }) {
          return canonicalEntities
            .filter(
              (entity) =>
                entity.entityName === input.entityName &&
                entity.path.startsWith(input.basePath) &&
                entity.rdfType.value === input.rdfType.value,
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
      canonicalChecks,
      upsertCanonicalEntity,
      removeCanonicalEntity,
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

  it("syncs graph repairs triggered by updated entity definitions", async () => {
    const { legacyEntity, currentEntity } =
      createRecanonicalizedEventFixtures();
    const storage = createMemoryStorage();
    const requests: Array<{
      path: string;
      patch: string;
      assertions: Triple[];
      retractions: Triple[];
    }> = [];

    const firstEngine = createEngine({
      entities: [legacyEntity],
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
      entities: [currentEntity],
      storage,
      pod,
      sync: {
        adapter: {
          async applyEntityPatch(request) {
            requests.push({
              path: request.path,
              patch: request.patch,
              assertions: request.assertions,
              retractions: request.retractions,
            });
          },
          async appendLogEntry() {
            // no-op
          },
        },
      },
    });

    await secondEngine.get("event", "ev-123");
    await secondEngine.sync.now();

    expect(requests).toHaveLength(2);
    expect(requests.at(-1)?.path).toBe("events/ev-123.ttl");
    expect(requests.at(-1)?.assertions).toHaveLength(1);
    expect(requests.at(-1)?.retractions).toEqual([]);
    expect(requests.at(-1)?.patch).toContain(
      '<https://example.com/id/event/ev-123> <https://example.com/ns#titleAlias> "Hello" .',
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
      timestamp: string;
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
              timestamp: request.timestamp,
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
    expect(logRequests[0]?.path).toMatch(/\.nt$/);
    expect(logRequests[0]?.timestamp).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(logRequests[0]?.assertions).toHaveLength(4);
    expect(logRequests[0]?.retractions).toHaveLength(0);
  });

  it("deletes the canonical entity resource and appends a retraction log entry", async () => {
    const { entity } = createEventFixture();
    const calls: string[] = [];
    const deletedPaths: string[] = [];
    const logRequests: Array<{
      path: string;
      rootUri: string;
      assertions: Triple[];
      retractions: Triple[];
    }> = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: {
          async applyEntityPatch() {
            calls.push("patch");
          },
          async deleteEntityResource(request) {
            calls.push("delete");
            deletedPaths.push(request.path);
          },
          async appendLogEntry(request) {
            calls.push("log");
            logRequests.push({
              path: request.path,
              rootUri: request.rootUri,
              assertions: request.assertions,
              retractions: request.retractions,
            });
          },
        },
      },
    });

    await engine.save("event", {
      id: "ev-delete",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await engine.sync.now();
    calls.length = 0;

    await engine.delete("event", "ev-delete");
    await engine.sync.now();

    expect(calls).toEqual(["delete", "log"]);
    expect(deletedPaths).toEqual(["events/ev-delete.ttl"]);
    expect(logRequests.at(-1)?.assertions).toEqual([]);
    expect(logRequests.at(-1)?.retractions).toHaveLength(4);
    expect(logRequests.at(-1)?.rootUri).toBe(
      "https://example.com/id/event/ev-delete",
    );
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("treats earlier unsynced changes as superseded when an entity is deleted before sync", async () => {
    const { entity } = createEventFixture();
    const calls: string[] = [];
    const engine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: {
          async applyEntityPatch() {
            calls.push("patch");
          },
          async deleteEntityResource() {
            calls.push("delete");
          },
          async appendLogEntry() {
            calls.push("log");
          },
        },
      },
    });

    await engine.save("event", {
      id: "ev-delete-before-sync",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await engine.delete("event", "ev-delete-before-sync");

    await engine.sync.now();

    expect(calls).toEqual(["delete", "log"]);
    await expect(engine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
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
    const remoteTimestamp = remote.logEntries[0]?.timestamp;

    await expect(secondStorage.listChanges("event", "ev-123")).resolves.toEqual(
      [
        expect.objectContaining({
          timestamp: remoteTimestamp,
        }),
      ],
    );
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

  it("replays a remote deletion by removing the entity locally", async () => {
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
      id: "ev-delete",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    await firstEngine.delete("event", "ev-delete");
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    await expect(secondEngine.get("event", "ev-delete")).resolves.toBeNull();
    await expect(secondEngine.list("event")).resolves.toEqual([]);
    await expect(
      secondStorage.listChanges("event", "ev-delete"),
    ).resolves.toHaveLength(2);
  });

  it("reconciles external canonical edits after log replay and queues only log projection", async () => {
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
      id: "ev-external",
      title: "Local",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    remote.upsertCanonicalEntity({
      entityName: "event",
      entityId: "ev-external",
      path: "events/ev-external.ttl",
      rootUri: "https://example.com/id/event/ev-external",
      rdfType: entity.rdfType,
      graph: eventGraph("ev-external", "External", 2026),
    });

    const beforeReconcileLogEntries = remote.logEntries.length;

    await secondEngine.sync.now();

    await expect(secondEngine.get("event", "ev-external")).resolves.toEqual({
      id: "ev-external",
      title: "External",
      time: {
        year: 2026,
      },
    });
    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });

    const changes = await secondStorage.listChanges("event", "ev-external");
    const reconciliationChange = changes.at(-1);

    expect(reconciliationChange).toMatchObject({
      entityProjected: true,
      logProjected: false,
    });
    expect(remote.logEntries).toHaveLength(beforeReconcileLogEntries);

    await secondEngine.sync.now();

    expect(remote.logEntries).toHaveLength(beforeReconcileLogEntries + 1);
    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "idle",
      configured: true,
      pendingChanges: 0,
    });
  });

  it("does not create a duplicate canonical reconciliation change when log replay already matches the Pod", async () => {
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
      id: "ev-deduped",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    await expect(secondEngine.get("event", "ev-deduped")).resolves.toEqual({
      id: "ev-deduped",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await expect(
      secondStorage.listChanges("event", "ev-deduped"),
    ).resolves.toHaveLength(1);
  });

  it("imports externally created canonical entities during sync", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    const storage = createMemoryStorage();
    const engine = createEngine({
      entities: [entity],
      pod,
      storage,
      sync: {
        adapter: remote.adapter,
      },
    });

    remote.upsertCanonicalEntity({
      entityName: "event",
      entityId: "ev-imported",
      path: "events/ev-imported.ttl",
      rootUri: "https://example.com/id/event/ev-imported",
      rdfType: entity.rdfType,
      graph: eventGraph("ev-imported", "Imported", 2027),
    });

    await engine.sync.now();

    await expect(engine.get("event", "ev-imported")).resolves.toEqual({
      id: "ev-imported",
      title: "Imported",
      time: {
        year: 2027,
      },
    });

    const changes = await storage.listChanges("event", "ev-imported");

    expect(changes.at(-1)).toMatchObject({
      entityProjected: true,
      logProjected: false,
    });
  });

  it("removes local entities when canonical resources are deleted externally", async () => {
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
      id: "ev-external-delete",
      title: "Hello",
      time: {
        year: 2024,
      },
    });
    await firstEngine.sync.now();
    await secondEngine.sync.now();

    remote.removeCanonicalEntity("event", "ev-external-delete");

    await secondEngine.sync.now();

    await expect(
      secondEngine.get("event", "ev-external-delete"),
    ).resolves.toBeNull();
    await expect(secondEngine.sync.state()).resolves.toEqual({
      status: "pending",
      configured: true,
      pendingChanges: 1,
    });

    const changes = await secondStorage.listChanges(
      "event",
      "ev-external-delete",
    );

    expect(changes.at(-1)).toMatchObject({
      assertions: [],
      entityProjected: true,
      logProjected: false,
    });
  });

  it("auto-merges non-conflicting concurrent edits and syncs the merge on the next sync", async () => {
    const { entity } = createEventFixture();
    const remote = createSharedRemoteAdapter();
    const firstStorage = createMemoryStorage();
    const secondStorage = createMemoryStorage();
    const firstEngine = createEngine({
      entities: [entity],
      pod,
      storage: firstStorage,
      sync: {
        adapter: remote.adapter,
      },
    });
    const secondEngine = createEngine({
      entities: [entity],
      pod,
      storage: secondStorage,
      sync: {
        adapter: remote.adapter,
      },
    });

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-09T10:00:00.000Z"));

      await firstEngine.save("event", {
        id: "ev-fork",
        title: "Base",
        time: {
          year: 2024,
        },
      });
      await firstEngine.sync.now();
      await secondEngine.sync.now();

      vi.setSystemTime(new Date("2026-04-09T10:01:00.000Z"));
      await firstEngine.save("event", {
        id: "ev-fork",
        title: "A",
        time: {
          year: 2024,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T10:02:00.000Z"));
      await secondEngine.save("event", {
        id: "ev-fork",
        title: "Base",
        time: {
          year: 2025,
        },
      });

      await firstEngine.sync.now();
      await secondEngine.sync.now();

      await expect(secondEngine.get("event", "ev-fork")).resolves.toEqual({
        id: "ev-fork",
        title: "A",
        time: {
          year: 2025,
        },
      });
      await expect(secondEngine.sync.state()).resolves.toEqual({
        status: "idle",
        configured: true,
        pendingChanges: 0,
      });

      await secondEngine.sync.now();
      await firstEngine.sync.now();

      await expect(firstEngine.get("event", "ev-fork")).resolves.toEqual({
        id: "ev-fork",
        title: "A",
        time: {
          year: 2025,
        },
      });
      await expect(secondEngine.sync.state()).resolves.toEqual({
        status: "idle",
        configured: true,
        pendingChanges: 0,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves conflicting concurrent edits by most recent timestamp", async () => {
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

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-09T11:00:00.000Z"));

      await firstEngine.save("event", {
        id: "ev-conflict",
        title: "Base",
        time: {
          year: 2024,
        },
      });
      await firstEngine.sync.now();
      await secondEngine.sync.now();

      vi.setSystemTime(new Date("2026-04-09T11:01:00.000Z"));
      await firstEngine.save("event", {
        id: "ev-conflict",
        title: "First wins?",
        time: {
          year: 2024,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T11:02:00.000Z"));
      await secondEngine.save("event", {
        id: "ev-conflict",
        title: "Second wins",
        time: {
          year: 2024,
        },
      });

      await firstEngine.sync.now();
      await secondEngine.sync.now();

      await expect(secondEngine.sync.state()).resolves.toEqual({
        status: "pending",
        configured: true,
        pendingChanges: 1,
      });

      const mergedChange = (
        await secondStorage.listChanges("event", "ev-conflict")
      ).at(-1);

      expect(mergedChange?.assertions).toEqual([]);
      expect(mergedChange?.retractions).toEqual([
        [
          uri("https://example.com/id/event/ev-conflict"),
          uri("https://example.com/ns#title"),
          "First wins?",
        ],
      ]);

      await secondEngine.sync.now();
      await firstEngine.sync.now();

      await expect(firstEngine.get("event", "ev-conflict")).resolves.toEqual({
        id: "ev-conflict",
        title: "Second wins",
        time: {
          year: 2024,
        },
      });
      await expect(secondEngine.get("event", "ev-conflict")).resolves.toEqual({
        id: "ev-conflict",
        title: "Second wins",
        time: {
          year: 2024,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to lexicographic change IDs when conflicting timestamps are equal", async () => {
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
    const secondEngine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });
    const idSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockImplementationOnce(() => "00000000-0000-0000-0000-000000000001")
      .mockImplementationOnce(() => "00000000-0000-0000-0000-000000000002")
      .mockImplementationOnce(() => "00000000-0000-0000-0000-000000000009")
      .mockImplementationOnce(() => "00000000-0000-0000-0000-000000000003")
      .mockImplementationOnce(() => "00000000-0000-0000-0000-000000000010");

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-09T12:00:00.000Z"));

      await firstEngine.save("event", {
        id: "ev-fallback",
        title: "Base",
        time: {
          year: 2024,
        },
      });
      await firstEngine.sync.now();
      await secondEngine.sync.now();

      vi.setSystemTime(new Date("2026-04-09T12:01:00.000Z"));
      await firstEngine.save("event", {
        id: "ev-fallback",
        title: "Alpha",
        time: {
          year: 2024,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T12:01:00.000Z"));
      await secondEngine.save("event", {
        id: "ev-fallback",
        title: "Zulu",
        time: {
          year: 2024,
        },
      });

      await firstEngine.sync.now();
      await secondEngine.sync.now();
      await secondEngine.sync.now();
      await firstEngine.sync.now();

      await expect(firstEngine.get("event", "ev-fallback")).resolves.toEqual({
        id: "ev-fallback",
        title: "Zulu",
        time: {
          year: 2024,
        },
      });
      await expect(secondEngine.get("event", "ev-fallback")).resolves.toEqual({
        id: "ev-fallback",
        title: "Zulu",
        time: {
          year: 2024,
        },
      });
    } finally {
      idSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not create duplicate merge changes when the same fork is replayed repeatedly", async () => {
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

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-09T13:00:00.000Z"));

      await firstEngine.save("event", {
        id: "ev-idempotent",
        title: "Base",
        time: {
          year: 2024,
        },
      });
      await firstEngine.sync.now();
      await secondEngine.sync.now();

      vi.setSystemTime(new Date("2026-04-09T13:01:00.000Z"));
      await firstEngine.save("event", {
        id: "ev-idempotent",
        title: "Remote",
        time: {
          year: 2024,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T13:02:00.000Z"));
      await secondEngine.save("event", {
        id: "ev-idempotent",
        title: "Base",
        time: {
          year: 2025,
        },
      });

      await firstEngine.sync.now();
      await secondEngine.sync.now();

      const afterFirstMerge = await secondStorage.listChanges(
        "event",
        "ev-idempotent",
      );

      await secondEngine.sync.now();
      await secondEngine.sync.now();

      const afterRepeatedReplay = await secondStorage.listChanges(
        "event",
        "ev-idempotent",
      );

      expect(afterFirstMerge).toHaveLength(afterRepeatedReplay.length);
    } finally {
      vi.useRealTimers();
    }
  });

  it("merges a three-way fork by combining non-conflicting edits and resolving conflicting ones deterministically", async () => {
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
    const secondEngine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });
    const thirdEngine = createEngine({
      entities: [entity],
      pod,
      storage: createMemoryStorage(),
      sync: {
        adapter: remote.adapter,
      },
    });

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-09T14:00:00.000Z"));

      await firstEngine.save("event", {
        id: "ev-three-way",
        title: "Base",
        time: {
          year: 2024,
        },
      });
      await firstEngine.sync.now();
      await secondEngine.sync.now();
      await thirdEngine.sync.now();

      vi.setSystemTime(new Date("2026-04-09T14:01:00.000Z"));
      await firstEngine.save("event", {
        id: "ev-three-way",
        title: "Alpha",
        time: {
          year: 2024,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T14:02:00.000Z"));
      await secondEngine.save("event", {
        id: "ev-three-way",
        title: "Base",
        time: {
          year: 2025,
        },
      });

      vi.setSystemTime(new Date("2026-04-09T14:03:00.000Z"));
      await thirdEngine.save("event", {
        id: "ev-three-way",
        title: "Zulu",
        time: {
          year: 2024,
        },
      });

      await firstEngine.sync.now();
      await secondEngine.sync.now();
      await thirdEngine.sync.now();
      await thirdEngine.sync.now();
      await firstEngine.sync.now();
      await secondEngine.sync.now();

      const expected = {
        id: "ev-three-way",
        title: "Zulu",
        time: {
          year: 2025,
        },
      };

      await expect(firstEngine.get("event", "ev-three-way")).resolves.toEqual(
        expected,
      );
      await expect(secondEngine.get("event", "ev-three-way")).resolves.toEqual(
        expected,
      );
      await expect(thirdEngine.get("event", "ev-three-way")).resolves.toEqual(
        expected,
      );
    } finally {
      vi.useRealTimers();
    }
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
      graph: eventGraph("ev-remote", "Remote", 2024),
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
      graph: eventGraph("ev-remote", "Remote", 2024),
    });
    remote.logEntries.push({
      entityName: "event",
      entityId: "ev-remote",
      changeId: "remote-1",
      parentChangeId: null,
      timestamp: "2026-04-09T12:00:00.000Z",
      path: "apps/my-journal/log/event/remote-1.nt",
      rootUri: "https://example.com/id/event/ev-remote",
      assertions: [
        [
          uri("https://example.com/id/event/ev-remote"),
          uri("https://example.com/ns#title"),
          "Historical",
        ],
      ],
      retractions: [
        [
          uri("https://example.com/id/event/ev-remote"),
          uri("https://example.com/ns#title"),
          "Remote",
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

    await engine.sync.bootstrap();
    await engine.sync.now();

    const changes = await remote.adapter.listLogEntries?.();

    expect(changes?.[0]?.timestamp).toBe("2026-04-09T12:00:00.000Z");

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
      graph: eventGraph("ev-123", "Remote title", 2024),
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

describe("detectForks", () => {
  it("returns an empty array when there are no forks", () => {
    expect(
      detectForks([
        {
          entityName: "event",
          entityId: "ev-1",
          changeId: "change-1",
          parentChangeId: null,
          timestamp: "2026-04-09T10:00:00.000Z",
          assertions: [],
          retractions: [],
          entityProjected: false,
          logProjected: false,
        },
        {
          entityName: "event",
          entityId: "ev-1",
          changeId: "change-2",
          parentChangeId: "change-1",
          timestamp: "2026-04-09T10:01:00.000Z",
          assertions: [],
          retractions: [],
          entityProjected: false,
          logProjected: false,
        },
      ]),
    ).toEqual([]);
  });

  it("identifies a fork when two changes share the same parent for one entity", () => {
    const forks = detectForks([
      {
        entityName: "event",
        entityId: "ev-1",
        changeId: "change-2a",
        parentChangeId: "change-1",
        timestamp: "2026-04-09T10:01:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
      {
        entityName: "event",
        entityId: "ev-1",
        changeId: "change-2b",
        parentChangeId: "change-1",
        timestamp: "2026-04-09T10:02:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
    ]);

    expect(forks).toEqual([
      {
        entityName: "event",
        entityId: "ev-1",
        parentChangeId: "change-1",
        branches: expect.arrayContaining([
          expect.objectContaining({ changeId: "change-2a" }),
          expect.objectContaining({ changeId: "change-2b" }),
        ]),
      },
    ]);
  });

  it("handles multiple independent forks across different entities", () => {
    const forks = detectForks([
      {
        entityName: "event",
        entityId: "ev-1",
        changeId: "ev-1-a",
        parentChangeId: "base-1",
        timestamp: "2026-04-09T10:01:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
      {
        entityName: "event",
        entityId: "ev-1",
        changeId: "ev-1-b",
        parentChangeId: "base-1",
        timestamp: "2026-04-09T10:02:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
      {
        entityName: "note",
        entityId: "note-1",
        changeId: "note-1-a",
        parentChangeId: "base-2",
        timestamp: "2026-04-09T10:03:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
      {
        entityName: "note",
        entityId: "note-1",
        changeId: "note-1-b",
        parentChangeId: "base-2",
        timestamp: "2026-04-09T10:04:00.000Z",
        assertions: [],
        retractions: [],
        entityProjected: false,
        logProjected: false,
      },
    ]);

    expect(forks).toHaveLength(2);
    expect(forks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityName: "event",
          entityId: "ev-1",
          parentChangeId: "base-1",
        }),
        expect.objectContaining({
          entityName: "note",
          entityId: "note-1",
          parentChangeId: "base-2",
        }),
      ]),
    );
  });
});
