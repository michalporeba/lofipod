# PLANS

This document lists the first small implementation features for `lofipod`.
Features should be built sequentially, but each one should stand on its own as
an independently testable public-API slice.

The feature order should validate both the design details in `API.md` and the
developer experience of building against the API.

## Feature roadmap

### 1. Namespace and entity registration API

Define the smallest public API for `defineNamespace(...)` and
`defineEntity<T>(...)`.

This should prove:

- a developer can register an entity with a TypeScript type, Pod base path, and
  RDF codec
- the API is small and understandable without a field-schema DSL
- entity definitions are sufficient input for later engine behaviour

### 2. Engine creation and configuration API

Define `createEngine(...)` with entity registration, Pod root configuration,
local storage, and sync adapter configuration.

This should prove:

- the engine configuration is explicit but not heavy
- app root and per-entity base paths fit together cleanly
- CRUD and sync capabilities can hang off one stable engine object

### 3. Local save and get for one entity type

Implement `engine.save(...)` and `engine.get(...)` for a single entity type
using local persistence only.

This should prove:

- the primary local-first CRUD loop feels natural
- identity-on-entity works well in practice
- serialized JSON plus library metadata is enough for the first local model

### 4. Local listing API

Implement `engine.list(entityName, options?)` with a deliberately narrow API.

This should prove:

- newest-first listing is sufficient for the first workflow
- a basic `limit` option is enough to validate list ergonomics
- the public API can support useful local reads without a query DSL

### 5. Browser persistence adapter

Persist the local state model in IndexedDB behind the configured storage layer.

This should prove:

- browser reload recovery
- separation between engine behaviour and storage implementation
- compatibility with fakes for most automated tests

### 6. Per-entity RDF codec contract

Implement the RDF mapping contract around `rdf.toRdf(...)` and
`rdf.fromRdf(...)`.

This should prove:

- the higher-level RDF context is expressive enough for realistic entities
- domain ontology stays application-owned
- RDF mapping remains explicit without a field-schema DSL

### 7. Pod bootstrap for reads

Hydrate a new client from Pod metadata and indexes using configured entity base
paths and codecs.

This should prove:

- the Pod path configuration is sufficient
- newest-first bootstrap matches the intended user experience
- the API design can support remote-first hydration without leaking storage
  internals

### 8. Pod projection on save

Project local saves to Pod revisions and indexes through the configured entity
codec and Pod layout.

This should prove:

- local CRUD remains the primary API even when remote projection is enabled
- append-only revision creation stays internal to the library
- application code does not need to manage RDF storage resources directly

### 9. Connection and sync status API

Implement `engine.connection.state()`, `engine.sync.state()`, and
`engine.sync.now()`.

This should prove:

- sync is inspectable without becoming central to ordinary CRUD
- the API can distinguish unconfigured, offline, and available remote states
- explicit sync triggers can exist without implying manual sync is the normal
  flow

### 10. Background sync orchestration

Add background sync on save, startup, focus, reconnect, and polling.

This should prove:

- normal use does not require a sync button
- repeated sync attempts are safe
- sync behaviour can remain mostly invisible unless the developer asks for
  status

### 11. Branch and conflict surface

Expose the first public conflict or branch state needed for concurrent Pod
writes.

This should prove:

- branch preservation remains compatible with the simple CRUD API
- the public API can surface conflict information without requiring manual
  merge-first workflows
- unresolved branch semantics become concrete enough for real implementation

### 12. Integration harness

Add focused integration tests against Inrupt's Community Solid Server in local
Docker.

This should prove:

- real Pod compatibility
- end-to-end sync through the public API
- separation between fast mocked tests and slower integration coverage

### 13. Optional framework bindings

Add a thin wrapper layer around the framework-agnostic core, with React as the
first candidate.

This should prove:

- the core remains independent of framework assumptions
- bindings can consume the engine API rather than redefine it
- the public API is suitable for use across multiple UI frameworks

## Testing guidance

- Prefer public-API tests over implementation-coupled tests.
- Use TDD where practical.
- Use mocks or fakes for most tests.
- Keep Docker-backed integration tests focused and few.
