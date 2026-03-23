# PLANS

This document lists the first small features for `lofipod`. Each feature should
be independently testable through the public API, even if features are built in
sequence.

## Provisional API direction

The current assumption is:

- a framework-agnostic core package
- likely public concepts such as:
  - defining an entity model
  - creating an engine
  - saving entity changes
  - reading materialized entities and lists
  - connecting local storage and Pod sync adapters
  - observing sync state
- React hooks, if added later, should wrap the core rather than define it

This is intentionally provisional and should be refined before implementation
goes too far.

## Feature roadmap

### 1. Entity model and message vocabulary

Define the minimal supported entity shape and the kinds of messages that can be
appended to the log.

This should prove:

- shallow entity support
- scalar, opaque, and unordered primitive-set property kinds
- a stable internal vocabulary for changes

### 2. Local transaction log

Build the append-only local message store with a public API for appending and
reading messages.

This should prove:

- stable message persistence semantics
- deterministic replay inputs
- behaviour-focused tests over the public log API

### 3. Materialized read model

Build a projector/materializer that derives current entity state from the log.

This should prove:

- normal reads do not depend on replaying the full log every time
- entity reads and list reads can be served from materialized state
- rebuild and recovery are deterministic

### 4. Save and diff calculation

Implement the logic that compares an edited entity with current state and emits
new messages.

This should prove:

- minimal message generation
- scalar updates
- opaque whole-value replacements
- unordered primitive-set add/remove behaviour

### 5. Browser storage adapter

Persist the log and materialized state in IndexedDB.

This should prove:

- browser reload recovery
- separation between core engine and storage adapter
- compatibility with test doubles for most automated tests

### 6. Pod serialization model

Define how local entities and messages map to RDF-compatible Pod resources.

This should prove:

- meta or manifest structure
- bucket index structure
- immutable revision shape
- compatibility with shallow entities

### 7. Pod pull bootstrap

Hydrate a fresh client from Pod metadata and bucket indexes, loading newest data
first.

This should prove:

- partial loading
- newest-first user experience
- no need to read the full dataset on startup

### 8. Pod push projection

Project local messages into Pod structures and keep mutable indexes up to date.

This should prove:

- automatic Pod write projection
- append-only revision creation
- index maintenance as part of sync

### 9. Background sync engine

Add sync orchestration for startup, save, focus, reconnect, and polling.

This should prove:

- no sync button required for normal use
- deterministic sync scheduling through the public API
- safe repeated sync attempts

### 10. Branch detection and current selection

Preserve concurrent branches and choose one current revision for normal reads.

This should prove:

- branch preservation
- current-revision selection rules
- conflict state exposure without full manual resolution UI

### 11. Integration harness

Add integration tests against Inrupt's Community Solid Server in local Docker.

This should prove:

- real Pod compatibility
- end-to-end sync through the public API
- separation between fast mocked tests and slower integration coverage

### 12. Optional React bindings

Add a thin React wrapper layer around the framework-agnostic core.

This should prove:

- the core remains independent of React
- React ergonomics can be added without redefining the architecture

## Testing guidance

- Prefer public-API tests over implementation-coupled tests.
- Use TDD where practical.
- Use mocks or fakes for most tests.
- Keep Docker-backed integration tests focused and few.
