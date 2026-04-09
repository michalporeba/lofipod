# API

## Status

Working draft for the public `lofipod` API. This document captures the current
developer-experience direction, but it is not an accepted architecture record.
`ADR.md` remains the source of truth for accepted architectural constraints.

## Purpose

The first public API should optimize for:

- single-user local-first CRUD as the primary developer experience
- Solid Pod sync as an important but secondary concern
- a framework-agnostic core that can later be wrapped for React or other UI
  libraries
- explicit RDF and Pod mapping without requiring a large schema DSL

## Core direction

The current public API direction is:

- a declarative core with entity registration and an engine object
- application-owned TypeScript types for entity payloads
- a thin model layer rather than a rich field-schema DSL
- per-entity RDF codecs as the main mapping mechanism
- typed RDF vocabulary and helper values at the public API boundary
- per-entity Pod base paths under a configured app root
- adapter-driven local persistence for projected entities, canonical graphs, and
  sync metadata
- sync exposed through a small status and trigger surface without making normal
  CRUD feel sync-driven

This means `lofipod` should own orchestration, local-first behaviour, sync, and
Pod projection mechanics, while application code owns domain types, ontology
terms, and entity-specific RDF mapping.

## Current public surface

The current public surface is still intentionally small and explicit:

- `defineVocabulary(...)`
- `defineEntity<T>(...)`
- `createEngine(...)`
- `createMemoryStorage(...)`
- `createIndexedDbStorage(...)`
- `createSqliteStorage(...)`
- `createSolidPodAdapter(...)`
- `engine.save(entityName, entity)`
- `engine.get(entityName, id)`
- `engine.list(entityName, options?)`
- `engine.delete(entityName, id)`
- `engine.dispose()`
- `engine.sync.state()`
- `engine.sync.now()`
- `engine.sync.bootstrap()`
- RDF helpers such as `uri(...)`, `literal(...)`, `objectOf(...)`,
  `stringValue(...)`, `numberValue(...)`, and `booleanValue(...)`

There is currently no `engine.connection.state()` API and no general
observation/subscription API yet.

This is intentionally not a full query or schema system. The initial API still
prefers stability and clarity over breadth.

## Entity definition contract

Each entity definition should include:

- `name`
- a TypeScript type parameter for the domain object
- `pod.basePath`
- `rdfType`
- `id(entity)`
- `toRdf(entity, helpers)`
- `project(graph, helpers)`

The initial assumptions are:

- identity lives on the entity object in v0
- RDF mapping is owned per entity, not globally
- `toRdf(...)` should be pure and should return RDF triples rather than mutate
  external state
- `project(...)` should be pure and should return a full projected object from
  the canonical entity graph
- embedded one-to-one structures can use path-based stable child node helpers
  such as `child("time")`
- the library owns its internal revision, index, and sync vocabulary
- application code owns domain ontology terms and entity mapping logic

The API should not require developers to define field kinds in a separate DSL
if the same information already exists in their TypeScript types and RDF
projection logic.

## Pod configuration contract

Engine-level Pod configuration currently includes:

- `logBasePath`

Per-entity Pod configuration should include:

- `basePath`

The current version lets developers choose:

- the app-private replication log base path in the Pod
- the collection or base path used for each entity type

The current version does not expose:

- full resource path callback hooks
- detailed customization of internal revision or index layout

The library should own exact revision and index resource naming within those
configured roots so the sync model remains coherent.

## Local storage and listing

The first local persistence approach should stay simple:

- keep local persistence adapter-driven and library-managed
- persist enough structured graph and metadata state for reliable restart and
  sync recovery
- keep local layout internal to the library

The first listing API should also stay intentionally narrow:

- list by entity type
- default to newest-first ordering
- support a basic `limit`
- defer rich filtering and query DSL design

## Sync and connection surface

Sync should be visible but not central to ordinary CRUD.

Developers should be able to:

- determine whether remote sync is configured at all
- inspect overall sync status
- trigger sync explicitly when needed
- rely on attached sync to run automatically after save/delete and after
  initial attach
- configure an optional `pollIntervalMs` for attached sync when they want a
  faster or slower polling cadence
- explicitly bootstrap from canonical remote resources on first attach or
  recovery
- delete an entity locally and have that deletion replicate through normal sync
- let optional adapter-level notifications wake remote sync earlier without
  changing correctness or requiring a subscription API in application code

Normal save, get, and list flows should work without requiring explicit sync
operations in the common case.
When omitted, the current default polling interval is 30 seconds, with
exponential backoff after consecutive sync failures.

## Example

```ts
import {
  createEngine,
  createIndexedDbStorage,
  createSolidPodAdapter,
  defineEntity,
  defineVocabulary,
  numberValue,
  rdf,
  stringValue,
} from "lofipod";

const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Event: "ns#Event",
    title: "ns#title",
    time: "ns#time",
    year: "ns#year",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`;
  },
});

type Event = {
  id: string;
  title: string;
  time: {
    year: number;
  };
};

const eventEntity = defineEntity<Event>({
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

  project(graph, { uri, child }) {
    const subject = uri();
    const time = child("time");

    return {
      id: subject.value.split("/").at(-1) ?? "",
      title: stringValue(graph, subject, ex.title),
      time: {
        year: numberValue(graph, time, ex.year),
      },
    };
  },
});

const engine = createEngine({
  pod: {
    logBasePath: "apps/my-journal/log/",
  },
  entities: [eventEntity],
  storage: createIndexedDbStorage(),
  sync: {
    adapter: createSolidPodAdapter({ podBaseUrl, authorization }),
  },
});

await engine.save("event", {
  id: "n1",
  title: "Hello",
  time: {
    year: 2024,
  },
});

const event = await engine.get("event", "n1");
const events = await engine.list("event", { limit: 20 });
await engine.delete("event", "n1");

const syncState = await engine.sync.state();
await engine.sync.now();
await engine.sync.bootstrap();
```

## Defaults and open points

Current defaults:

- identity is part of the entity object
- per-entity RDF codecs are the default mapping mechanism
- public vocabulary terms and URI helpers are `NamedNode`-based
- per-entity Pod base paths are supported
- local persistence is adapter-driven, with in-memory, IndexedDB, and SQLite
  storage currently available
- sync state is inspectable, but CRUD should remain the primary experience
- bootstrap from canonical Pod resources is explicit rather than automatic

Still open:

- the exact helper set exposed to `project(...)`
- the exact list and cursor API beyond basic newest-first listing
- what framework-agnostic observation API should exist before React bindings
- how conflict and branch state should eventually appear in the public API
