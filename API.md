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

- `defineNamespace(...)`
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
- `rdf.class`
- `rdf.toRdf(entity, ctx)`
- `rdf.fromRdf(ctx)`

The initial assumptions are:

- identity lives on the entity object in v0
- RDF mapping is owned per entity, not globally
- the RDF context should be higher-level than raw triples
- the library owns its internal revision, index, and sync vocabulary
- application code owns domain ontology terms and entity mapping logic

The API should not require developers to define field kinds in a separate DSL
if the same information already exists in their TypeScript types and RDF codec.

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
import { createEngine, defineEntity, defineNamespace } from "lofipod"

const ns = defineNamespace({
  ex: "https://example.com/ns#",
  schema: "http://schema.org/",
})

type Note = {
  id: string
  title: string
  body: string
  tags: string[]
  metadata?: { pinned?: boolean }
}

const noteEntity = defineEntity<Note>({
  name: "note",
  pod: {
    basePath: "notes/",
  },
  rdf: {
    class: ns.ex("Note"),
    toRdf(note, ctx) {
      return [
        ctx.type(ns.ex("Note")),
        ctx.literal(ns.schema("headline"), note.title),
        ctx.literal(ns.schema("text"), note.body),
        ...note.tags.map((tag) => ctx.literal(ns.ex("tag"), tag)),
        ...(note.metadata ? [ctx.json(ns.ex("metadata"), note.metadata)] : []),
      ]
    },
    fromRdf(ctx) {
      return {
        id: ctx.id(),
        title: ctx.requiredString(ns.schema("headline")),
        body: ctx.requiredString(ns.schema("text")),
        tags: ctx.strings(ns.ex("tag")),
        metadata: ctx.optionalJson(ns.ex("metadata")),
      }
    },
  },
})

const engine = await createEngine({
  pod: {
    root: "/apps/my-journal/",
  },
  entities: [noteEntity],
  storage: indexedDbStorage(),
  sync: solidSync({ podUrl, auth }),
})

await engine.save("note", {
  id: "n1",
  title: "Hello",
  body: "World",
  tags: ["draft"],
})

const note = await engine.get("note", "n1")
const notes = await engine.list("note", { limit: 20 })

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

- the exact shape of the RDF context helpers
- the exact list and cursor API beyond basic newest-first listing
- whether any observation API belongs in the first public surface
- how conflict and branch state should eventually appear in the public API
