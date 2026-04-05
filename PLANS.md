# PLANS

This document tracks the first implementation slices for `lofipod` and the
next planned work. Features should still stand on their own as independently
testable public-API slices.

The project remains centered on developer activities and high test coverage.
Most tests should exercise the public API and verify persistence behaviour.
Solid Pod integration should stay mostly mocked, with a smaller focused real
integration suite.

## Completed roadmap

### 1. Define one entity and its RDF projection

Let a developer define one entity type, its identity rule, Pod location,
`toRdf(...)`, and `project(...)`.

This should prove:

- `defineVocabulary(...)`
- `defineEntity<T>(...)`
- pure `toRdf(...)`
- pure `project(...)`
- embedded one-to-one child nodes such as `child("time")`

### 2. Save and load one entity locally in memory

Let a developer create an engine, save one entity, and read it back.

This should prove:

- `createEngine(...)`
- `engine.save(...)`
- `engine.get(...)`
- canonical graph generation from entity object
- projection back to the application object

### 3. Persist the local canonical graph, read model, and transaction log atomically

Let a developer save an entity and rely on the local state surviving restart
without partial writes.

This should prove:

- local transaction boundaries
- local graph store
- local read model store
- local graph-delta log with assertions and retractions
- recovery from persisted local state

### 4. Update an entity and verify graph deltas

Let a developer update an entity and rely on only the graph differences being
recorded internally.

This should prove:

- diff between previous and new canonical entity graph
- assertions and retractions grouped by entity-scoped change
- stable child node handling for embedded structures
- per-triple deletion behaviour

### 5. List entities from the local read model

Let a developer save several entities and list them through the public API.

This should prove:

- `engine.list(...)`
- local read model as the source of application-facing queries
- default ordering and `limit`

### 6. Rehydrate from stored graph state

Let a developer restart the app and rebuild entities from stored canonical
graph state.

This should prove:

- `project(...)` is sufficient for recovery
- the read model can be rebuilt from graph state
- projected objects do not depend on original in-memory instances

### 7. Add IndexedDB storage adapter

Let a developer use the same public API with browser persistence.

This should prove:

- IndexedDB storage support
- the same storage contract as in-memory and fake adapters
- restart persistence in a browser-like environment

### 8. Expose local sync status and pending changes

Let a developer inspect whether there are unsynced local changes.

This should prove:

- `engine.sync.state()`
- distinction between no sync configured and pending local changes
- local log as the basis for sync state

### 9. Project local changes to canonical Pod entity files through a mocked Pod adapter

Let a developer enable sync and have local saves update canonical Pod entity
resources through a mocked Pod adapter.

This should prove:

- mocked Solid/Pod adapter contract
- compilation of graph deltas into N3 Patch
- per-entity Pod file updates
- idempotent retry behaviour for entity-file sync

### 10. Append replication log entries to the mocked Pod log

Let a developer sync changes and have the app-private remote replication log
advance.

This should prove:

- bucketed app-private log writing
- sequential sync projection
- change envelope plus assertions and retractions
- retry-safe remote log append behaviour

### 11. Pull remote changes from the mocked Pod log and update local state

Let a developer open the app on another device and receive remote changes
through sequential log replay.

This should prove:

- sequential remote log replay
- applying assertions and retractions to local graph state
- projection into the local read model from remote-originated changes
- tolerance for duplicate remote log entries

### 12. Add focused integration tests against a real Solid server

Let a developer use the library against an actual Solid Pod for a small number
of end-to-end checks.

This should prove:

- real N3 Patch compatibility
- real file layout compatibility
- real authentication and resource update flow

## Next roadmap

### 13. Refine remote discovery and recovery

Plan and implement the next remote discovery model on top of the current
bootstrap import and sequential log replay.

This should prove:

- canonical `./<entity>/` resources remain the correctness source
- per-app logs remain acceleration rather than required discovery infrastructure
- applications can recover compatible canonical data created by other tools
- out-of-band canonical edits can be detected and reconciled deliberately

### 14. Add a framework-agnostic observation API

Expose a small core observation surface before adding framework bindings.

This should prove:

- the core can publish entity or query updates without framework assumptions
- projected object replacement remains driven by core graph state
- UI bindings can subscribe without taking ownership of persistence or sync

### 15. Prepare package boundaries for framework bindings

Restructure the repository for separate core and binding packages.

This should prove:

- `lofipod` remains independently consumable
- a future binding package can depend on the core without leaking React into it
- the repo layout can support shared tooling and release flow across packages

### 16. Add React bindings as a separate package

Add a thin wrapper layer around the framework-agnostic core, with React as the
first candidate.

This should prove:

- the core remains independent of framework assumptions
- bindings can consume the engine and observation APIs rather than redefine them
- the public API is suitable for use across multiple UI frameworks

## Testing guidance

- Prefer public-API tests over implementation-coupled tests.
- Use TDD where practical.
- Use mocks or fakes for most tests, especially for Pod sync behaviour.
- Add shared storage contract tests that run against in-memory, fake, and
  IndexedDB-backed storage implementations.
- Keep Docker-backed Solid integration tests focused and few.
- Prioritise tests that verify persistence correctness, restart recovery, graph
  delta behaviour, and public API semantics.
- For the next roadmap, prioritise tests around canonical recovery,
  cross-application discovery, and framework-agnostic observation semantics.
