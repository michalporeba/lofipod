# ADR

## Status

Accepted as the initial architecture and constraints record for `lofipod`.

## Purpose

This document captures the current technical decisions, deliberate constraints,
and known boundaries for the project.

## Accepted decisions

### Positioning

- `lofipod` is a local-first, minimal ("lo-fi") SOLID Pod sync engine.
- The first target is browser-based TypeScript applications.
- The core should be framework-agnostic.
- React support should come later as optional bindings rather than as a core
  dependency.

### Language and packaging

- The project should be implemented in TypeScript.
- The published package should be consumable from plain JavaScript projects.
- Types are part of the developer experience, but not required of consumers.
- The framework-agnostic core should remain in the `lofipod` package.
- Future framework bindings should be published as separate packages in the
  same repository rather than folded into the core package.

### Data model

- The supported model is intentionally narrow.
- Entities are shallow objects.
- The public RDF-facing API should use typed RDF terms rather than plain
  strings for vocabulary values and helper-generated URIs, while still allowing
  convenient scalar literal values in triple objects.
- Supported property kinds are:
  - primitive scalar values
  - opaque atomic values for nested objects or small collections
  - optional unordered primitive-value sets
- Ordered replicated collections are out of scope for the core model.
- Deep graph merge semantics are out of scope.

### Local-first storage

- Local storage should use an append-only transaction log.
- The engine should maintain a materialized local read model.
- Normal reads should use the materialized read model, not replay the raw log
  on every access.
- Saves should compare against the current local entity graph and emit graph
  delta assertions and retractions into the transaction log.
- Reads may repair stale stored projections or canonical graphs when the
  current entity definition implies a different canonicalization; graph repairs
  should be recorded as normal local changes so they sync like any other delta.

### SOLID Pod backing

- SOLID Pods are the durable backing store and sync target.
- Canonical current state should be stored as one RDF resource per main entity,
  under a per-entity directory such as `./<entity>/<id>.ttl`.
- Entity resources are the canonical reusable Pod data and should be sufficient
  to reconstruct application state.
- Pod writes to canonical entity resources should use idempotent patch-style
  updates such as N3 Patch.
- Embedded mutable structures inside an entity resource require stable IDs.
- Pod-side indexing should be minimal and should exist only to support
  replication efficiency rather than application-facing queries.
- The application should not depend on Pod-side indexes for normal list or read
  behaviour.
- The initial Pod shape should also include an app-private, bucketed replication
  log under a path such as `./apps/<app_name>/log/`.
- The replication log is sync infrastructure, not the canonical data model.
- Replication log entries should be stored as N-Triples resources for
  unambiguous machine parsing, while canonical entity resources remain Turtle.
- The initial Pod shape should use:
  - canonical entity resources
  - a bucketed app-private replication log
  - minimal mutable metadata for log discovery
- Bucket and log design exists to support sequential replication rather than
  Pod-side application querying.
- Canonical entity directories are also the mandatory recovery and
  cross-application discovery surface.
- Data created or edited by another application must still be recoverable from
  canonical entity resources even if there is no compatible app-private log.
- Any shared `apps/lofipod/` interoperability area is optional future
  infrastructure, not a correctness dependency.

### Synchronisation

- Background sync should be expected on save, startup, focus, reconnect, and
  periodic polling.
- Manual sync should not be required for normal operation.
- When a sync adapter is attached, local saves and deletes should queue a
  background sync cycle after the local transaction commits.
- The engine should support attaching and detaching a Pod sync adapter at
  runtime without rebuilding local state.
- Solid notifications are an enhancement path, not a baseline dependency.
- Notification subscriptions should stay adapter-driven. The engine may ask an
  adapter to subscribe to canonical and log containers, but correctness must
  still rely on ordinary pull-based sync when subscriptions are unavailable or
  fail.
- Concurrent branches should be preserved rather than discarded.
- One branch may be chosen as current automatically for normal reads.
- Initial replication should be sequential rather than priority-driven.
- A local save should be committed transactionally to the local change log, the
  local entity graph state, and the local read model before remote sync.
- Remote sync should project local changes to canonical entity resources first
  and then append the same logical changes to the Pod replication log.
- Entity deletions should remove the canonical Pod resource with HTTP `DELETE`
  and still append a retraction-only replication log entry so other devices can
  replay the deletion locally.
- First attach to an existing Pod should support explicit bootstrap import from
  canonical entity directories.
- Persisted Pod connection metadata may survive restart, but live attachment
  still requires the application to supply a runtime adapter.
- Bootstrap import should be additive by default:
  - import missing local entities
  - skip identical local and remote entities
  - report differing entities as collisions rather than overwriting either side
- Sequential replay of app-private logs is an acceleration path, not the only
  valid remote discovery mechanism.
- When remote replay reveals concurrent branches for the same entity, the
  engine should reconcile them locally by merging non-conflicting triple-level
  edits and resolving true conflicts deterministically by timestamp, then
  lexicographic `changeId`.
- Remote sync should also poll canonical entity containers for version changes.
  If a container changed and the current canonical `.ttl` graph still differs
  from local state after log replay, the engine should treat that as an
  external canonical edit, reconcile local state to the remote graph, and
  queue a local log append without re-projecting the canonical file again.
- Canonical reconciliation should ignore entities that still have pending local
  changes so remote polling does not trample unsynced local work or merge
  results.
- When adapter-driven container notifications are available, the engine should
  subscribe on attach and use notifications only to wake the existing sync
  paths earlier. Notification-triggered sync should be serialized with manual
  sync and should fall back silently to polling when subscriptions fail or
  disconnect.
- Attaching sync at startup or runtime should also queue a background sync
  cycle so remote log replay and canonical reconciliation happen without an
  explicit `sync.now()`.
- Realtime collaborative editing is out of scope.

### Local-first query model

- The client-local store is the primary query and UX database.
- All application-facing queries and lists should be served from the local read
  model.
- The Pod should be treated as a durable replication medium and interoperable
  current-state store, not as the primary operational query engine.

### Change log model

- The replication model should use entity-scoped graph deltas rather than
  object-level events.
- The log is not a record of entity objects.
- The log is a record of graph deltas grouped by entity-scoped transaction.
- Each change should apply to exactly one entity graph.
- Each change should contain:
  - `entityId`
  - `changeId`
  - optional `parentChangeId`
  - creation timestamp
  - assertions
  - retractions
- Assertions and retractions should use RDF triple semantics.
- Triple deletion should be recorded per triple, not per node.
- Forks are identified when multiple changes for the same entity share the same
  `parentChangeId`; detection is metadata only and does not yet change sync
  behaviour.

### Reliability and testing

- Reliability is a first-class project goal.
- TDD should be used where practical.
- Automated tests should focus on externally visible behaviour through the
  public API.
- Most tests should use mocks or fakes so CI remains fast and deterministic.
- Integration tests should run against Inrupt's Community Solid Server in local
  Docker.

## Constraints

- Do not assume there is an off-the-shelf JS/TS library that already solves
  local-first sync with SOLID Pods well enough.
- The project should stay minimal rather than expanding into a general sync
  framework for arbitrary RDF graphs.
- Any internal design should remain compatible with RDF serialization at the
  Pod boundary.

## Open questions

- What minimal metadata is required for bucket discovery and log replay?
- What framework-agnostic observation API is needed before React bindings are
  added?
- How should branch/conflict state be exposed to consumers?
- How far should unordered primitive sets go in the RDF mapping?
