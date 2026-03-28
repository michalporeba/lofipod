# WIP

This file is for agent memory and may be longer or rougher than the other
documents.

## Project intention

`lofipod` is intended to explore a practical, minimal architecture for
browser-based local-first applications that use SOLID Pods as a durable backing
store and synchronisation target.

The goal is not to build a general CRDT engine or a generic RDF graph merge
system. The goal is to find a workable subset that is reliable, testable, and
pleasant to build applications on top of.

## Current problem framing

The central problem is:

- local-first browser applications need a strong local working model
- SOLID Pods are attractive for portability and identity
- there is no obvious mature JS/TS library that cleanly combines those two
- reading the whole Pod on startup is not acceptable
- manual sync should not be required
- realtime collaborative editing is not needed

The likely users of the library are application developers building React or
other browser-based applications, but the engine itself should remain
framework-agnostic.

## Chosen scope reductions

The discussion narrowed the model deliberately to keep it tractable:

- entities are shallow objects
- scalar primitive values are first-class
- nested objects and small collections are treated as opaque atomic values
- unordered primitive-value collections may be supported as a special case
- ordered replicated collections are out of scope
- deep graph merge semantics are out of scope

This is intended to reduce both CRDT complexity and RDF modeling complexity.

## Local-first model

The current architecture direction is:

- append-only local transaction log
- materialized local read model
- normal reads from the materialized model
- replay used for rebuild or verification, not hot-path reads

Saving an entity should work roughly like this:

1. load current local entity graph
2. compare edited entity graph to current entity graph
3. generate graph delta assertions and retractions
4. append them to the local transaction log
5. update the local entity graph state
6. update the materialized local read model
7. queue Pod sync / projection

This implies the exact log representation still needs to be designed, but the
current direction is an entity-scoped graph delta log rather than an object
message vocabulary.

## Pod-side model

The current Pod direction is now:

- canonical current-state RDF entity resources
- a bucketed app-private replication log
- minimal metadata for log discovery

Current layout idea:

- `./<entity>/<id>.ttl`
  - canonical current RDF state for one main entity
  - intended to be reusable by other applications
  - should be sufficient to reconstruct application state
  - updated with idempotent patch-style writes such as N3 Patch

- `./apps/<app_name>/log/`
  - app-private replication infrastructure

- `./apps/<app_name>/log/<bucket>/...`
  - append-oriented log buckets for sequential sync and replay

Important decisions from the discussion:

- the Pod should not carry application-facing query indexes
- Pod indexing should be minimal and only support replication efficiency
- canonical entity files are the reusable data model
- the replication log is infrastructure and can be recreated later if needed
- embedded mutable nodes need stable IDs for patching
- branches should be preserved if two clients write from the same parent
- one branch may be chosen current automatically for normal reads

## Loading and sync flow

The intended flow is currently:

- local save -> atomically write local graph delta log, local entity graph
  state, and local read model
- background sync -> patch canonical entity file in the Pod
- background sync -> append the same logical change to the Pod replication log
- fresh client -> read replication log sequentially
- fresh client -> fetch canonical entity files as needed to materialize local
  state
- reconnect or refresh should not require a manual sync action
- notifications may help later, but polling/startup/focus/reconnect should be
  sufficient as the baseline

Current simplification:

- no smart prioritisation of entities during initial sync
- no Pod-side list indexes for application use
- all application-facing lists should come from the local read model

## Change log model

The change log is now thought of as:

- not a record of entity objects
- a record of graph deltas grouped by entity-scoped transaction

Each change should apply to one entity graph and contain:

- `entityId`
- `changeId`
- optional `parentChangeId`
- assertions
- retractions

Further notes:

- assertions and retractions should use triple semantics
- graph scope comes from the enclosing entity identity rather than repeating a
  quad graph term on every statement
- triple deletion should be per triple, not per node
- local persistence can use more implementation-specific formats if useful, but
  the model should stay graph-delta based

## Current open design questions

- exact RDF shape of the replication log entries
- exact RDF shape of the minimal log discovery metadata
- how to represent branch metadata
- whether unordered primitive sets should be projected as repeated triples
- how the public API should look in detail
- how React bindings should wrap the core without leaking framework assumptions

## API direction so far

Nothing is fixed yet, but likely public concepts include:

- define model
- create engine
- save entity
- get entity
- list entities
- observe sync state
- configure local storage adapter
- configure Pod sync adapter

The React story should come later as hooks wrapping the core.

## Testing stance

Reliability is an explicit project goal.

Testing guidance from the discussion:

- use TDD where practical
- prefer tests that assert public behaviour through the library API
- avoid tests that only lock internal implementation details
- use mocks/fakes for most unit and sync tests
- use Inrupt's Community Solid Server in Docker for integration tests
- keep CI efficient by minimizing heavyweight Pod-backed tests

## Useful framing for future sessions

The project is best described as:

- local-first
- minimal / lo-fi
- SOLID Pod sync engine

Not as:

- a generic RDF engine
- a general CRDT framework
- a React state library

The ideal outcome is a small, reliable, understandable core that solves a
useful subset of the problem well.
