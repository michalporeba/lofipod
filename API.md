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
- per-entity Pod base paths under a configured app root
- local persistence based on serialized JSON plus library-managed metadata
- sync exposed through a small status and trigger surface without making normal
  CRUD feel sync-driven

This means `lofipod` should own orchestration, local-first behaviour, sync, and
Pod projection mechanics, while application code owns domain types, ontology
terms, and entity-specific RDF mapping.

## Proposed public surface

The first public surface should stay small and explicit:

- `defineVocabulary(...)`
- `defineEntity<T>(...)`
- `createEngine(...)`
- `engine.save(entityName, entity)`
- `engine.get(entityName, id)`
- `engine.list(entityName, options?)`
- `engine.connection.state()`
- `engine.sync.state()`
- `engine.sync.now()`

This is intentionally not a full query or schema system. The initial API should
prefer stability and clarity over breadth.

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

Engine-level Pod configuration should include:

- `root`

Per-entity Pod configuration should include:

- `basePath`

The first version should let developers choose:

- the application root directory in the Pod
- the collection or base path used for each entity type

The first version should not expose:

- full resource path callback hooks
- detailed customization of internal revision or index layout

The library should own exact revision and index resource naming within those
configured roots so the sync model remains coherent.

## Local storage and listing

The first local persistence approach should stay simple:

- store the serialized entity object as JSON
- store sync and identity metadata in dedicated library-managed fields
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
- observe whether the remote is currently reachable
- inspect overall sync status
- trigger sync explicitly when needed

Normal save, get, and list flows should work without requiring explicit sync
operations in the common case.

## Example

```ts
import { createEngine, defineEntity, defineVocabulary, rdf } from "lofipod"

const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Event: "ns#Event",
    title: "ns#title",
    time: "ns#time",
    year: "ns#year",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`
  },
})

type Event = {
  id: string
  title: string
  time: {
    year: number
  }
}

const eventEntity = defineEntity<Event>({
  name: "event",
  pod: {
    basePath: "events/",
  },
  rdfType: ex.Event,
  id: (event) => event.id,

  toRdf(event, { uri, child }) {
    const subject = uri(event)
    const time = child("time")

    return [
      [subject, rdf.type, ex.Event],
      [subject, ex.title, event.title],
      [subject, ex.time, time],
      [time, ex.year, event.time.year],
    ]
  },

  project(graph, { uri, child }) {
    const subject = uri()
    const time = child("time")

    return {
      id: idFromUri(subject),
      title: objectOf(graph, subject, ex.title),
      time: {
        year: numberObjectOf(graph, time, ex.year),
      },
    }
  },
})

const engine = await createEngine({
  pod: {
    root: "/apps/my-journal/",
  },
  entities: [eventEntity],
  storage: indexedDbStorage(),
  sync: solidSync({ podUrl, auth }),
})

await engine.save("event", {
  id: "n1",
  title: "Hello",
  time: {
    year: 2024,
  },
})

const event = await engine.get("event", "n1")
const events = await engine.list("event", { limit: 20 })

const connection = engine.connection.state()
const syncState = engine.sync.state()
await engine.sync.now()
```

## Defaults and open points

Current defaults:

- identity is part of the entity object
- per-entity RDF codecs are the default mapping mechanism
- per-entity Pod base paths are supported
- local persistence is JSON-centric in the first cut
- sync state is inspectable, but CRUD should remain the primary experience

Still open:

- the exact helper set exposed to `project(...)`
- the exact list and cursor API beyond basic newest-first listing
- whether any observation API belongs in the first public surface
- how conflict and branch state should eventually appear in the public API
