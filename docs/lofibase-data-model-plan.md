# LofiBase Data Model and Storage Mapping

## Summary
Design LofiBase around a `JS-native entity model` with `mutable remote heads` as the primary representation in v1, while keeping the remote wire/storage shape compatible with a later `SPARQL-backed personal RDF service`.

The core idea is:
- React and app code work with plain typed JS objects.
- The local database stores normalized entity rows plus local query indexes.
- Each backend adapter maps those entities to backend-specific remote storage.
- RDF is the remote shape and interchange layer, not the in-memory runtime model.
- The abstract remote model should be `named graphs / entity resources with per-entity metadata`, so it can later map either to:
  - Solid Pod files/resources
  - Google Drive files
  - private SPARQL endpoint named graphs

## Key Changes / Design

### 1. Core JS-native data model
Use a backend-agnostic entity envelope as the library's public model:

```ts
type EntityId = string
type EntityType = string
type RevisionId = string
type BackendId = "solid" | "drive" | string

type EntityEnvelope<T> = {
  id: EntityId
  type: EntityType
  revision: RevisionId
  createdAt: string
  updatedAt: string
  deleted?: boolean
  payload: T
}

type EntityMetadata = {
  remoteVersion?: string
  lastSyncedAt?: string
  syncState: "synced" | "pending" | "conflict"
}
```

Rules:
- `payload` must stay plain JS data: primitives, arrays, nested objects, nullable fields.
- Do not expose RDF terms or quads in the main app-facing API.
- Each entity type defines its own typed payload schema plus a codec to and from RDF.

### 2. RDF mapping model
Define a per-entity RDF mapping layer, not a global "document as arbitrary triples" model.

Each entity maps to:
- one canonical subject IRI for the entity
- one RDF resource / named graph containing the current head state
- optional metadata triples for type, timestamps, revision, deleted flag
- one or more typed predicates for payload fields

Recommended structure:
- envelope fields map to shared LofiBase vocabulary terms
- payload fields map through per-entity codecs
- nested objects map to either:
  - embedded blank-node subgraphs for small nested structures
  - referenced child entities when nested records need independent identity/queryability

Default rule for nested data:
- inline nested objects as blank nodes if they have no independent lifecycle
- split to child entities only when they need independent update/list/query behavior

### 3. Remote storage model by backend

#### Solid Pod adapter
Use `entity folders with mutable head files`.

Recommended layout:
- `/apps/lofibase/{entityType}/{entityId}/head.ttl`
- `/apps/lofibase/{entityType}/index/recent-{bucket}.ttl`
- optional later: `/apps/lofibase/{entityType}/{entityId}/history/{revision}.ttl`

Behavior:
- `head.ttl` is the current canonical state for that entity
- index files list entity IRIs, updated timestamps, and minimal list metadata
- sync reads index files first, then fetches changed heads only
- updates prefer `PATCH` for small changes to `head.ttl`
- fall back to `PUT` when patching is too complex or document shape changed substantially

Why this fits Solid:
- minimizes resource count compared with append-only-per-edit
- keeps reads simple
- uses PATCH where it helps
- leaves room to add history later without changing the public model

Important note on duplicate triples:
- RDF graphs are sets, not multisets. Exact duplicate triples are not meaningful as stored state.
- So "append-only by adding the same subject/predicate with more values to the same file" is not a sound generic history model.
- You can append more triples if they are distinct triples, but that creates a larger mutable graph, not a proper append-only log.
- If you want append-only semantics, use separate revision resources or explicit event/revision nodes, not repeated mutation of one file by accumulating stale triples forever.

#### Google Drive adapter
Use the same logical structure, but as app-private files under `appDataFolder`.

Recommended layout:
- `/{entityType}/{entityId}/head.ttl`
- `/{entityType}/index/recent-{bucket}.ttl`
- optional later: `/{entityType}/{entityId}/history/{revision}.ttl`

Behavior:
- use full file replace as the normal write path
- Drive changes feed is the primary incremental pull mechanism
- PATCH-like triple editing is not a first-class concern here; file replacement is simpler and more natural

This keeps the remote logical model aligned with Solid while allowing a different transport/update strategy.

#### Future private SPARQL endpoint
Model each entity head as a named graph.

Recommended mapping:
- graph IRI corresponds to logical entity resource URI
- graph contents are exactly the triples that would otherwise live in `head.ttl`
- index information can be:
  - derived through SPARQL queries, or
  - materialized into explicit index graphs if needed for consistency with other adapters

This is why SPARQL should be a first-class design target now:
- the abstract remote model should be "entity head graph + index projections"
- not "file tree semantics baked into the core API"

### 4. Sync and mutation policy
Use mutable heads as canonical remote state in v1.

Policy:
- local DB tracks dirty entities and field-level diffs only for optimization, not as the public storage model
- sync pushes the current entity head, not a required operation log
- Solid adapter may generate N3 Patch from local diff when feasible
- Drive adapter normally uploads the new serialized head
- SPARQL adapter later can use DELETE/INSERT WHERE or full graph replace

Conflict policy for v1:
- optimistic concurrency per entity head
- if remote version changed, refetch head and merge at entity level
- default merge rule:
  - scalar fields: last-writer-wins by `updatedAt`
  - object fields: replace whole field
  - arrays: replace whole field unless entity type defines custom merge
- expose conflict hooks for advanced entity-specific merge policies
- do not require CRDTs in the core model

### 5. Indexing and query model
Do not query RDF directly in the frontend runtime.

Local DB should maintain:
- `entities` table by id/type
- secondary indexes for recent items, by type, by updatedAt
- sync metadata table by backend
- optional denormalized list projections for fast UI

Remote index strategy:
- each backend maintains lightweight index projections for:
  - recently updated entities
  - collection membership
  - optional type buckets / time buckets
- index entries should include only list metadata needed to decide what to fetch next:
  - entity id / IRI
  - type
  - updatedAt
  - revision
  - deleted flag
- canonical data stays in the entity head, not duplicated fully in the index

For SPARQL later:
- these remote index files/graphs can become optional because the backend can answer filtered queries directly
- the core sync API should therefore model "list changed entity refs since cursor", not "read recent-bucket file" as the abstraction

## Test Plan
Validate the design against these scenarios:

- Create/update/delete a note entity with nested fields in plain JS, then round-trip through RDF codec without data loss.
- Sync a local entity to Solid as a mutable `head.ttl` and update it later via generated N3 Patch.
- Sync the same logical entity model to Drive by replacing `head.ttl` and updating index files.
- Fetch only changed entities after another device edits one item.
- Simulate concurrent edit conflict on one entity and confirm merge policy produces deterministic local state.
- Confirm nested non-identity objects serialize inline and do not force extra child-entity resources.
- Confirm the abstract remote model can map one entity head to one SPARQL named graph without changing the app-facing entity API.

## Assumptions and Defaults
- V1 canonical remote shape is `mutable entity heads`, not append-only revisions.
- History is optional and deferred; add it later as sidecar revision resources/graphs without breaking the API.
- RDF is the remote interchange model, not the primary local query engine.
- Solid uses PATCH opportunistically, not universally; PUT remains a valid fallback.
- Google Drive uses whole-file replace as the normal write strategy.
- Future SPARQL support is a real design target, so core abstractions must represent remote state as logical entity graphs plus index projections rather than filesystem-specific operations.
