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

1. load current materialized entity
2. compare edited entity to current entity
3. generate new messages
4. append them to the local log
5. update the materialized local read model
6. queue Pod sync / projection

This implies a message vocabulary still needs to be designed.

## Pod-side model

The current Pod direction is based on:

- mutable metadata and indexes for efficient loading
- immutable revisions for canonical history

Current event-oriented layout idea:

- `events/meta.ttl`
  - current open bucket id
  - current year
  - current bucket sequence

- `events/<yyyy-NNNN>/`
  - bucket directory

- `events/<yyyy-NNNN>/index.ttl`
  - mutable summaries
  - latest version references
  - enough information for list display

- `events/<yyyy-NNNN>/<timestamp-iso>-<version-uuid>.ttl`
  - immutable revision resource

Important decisions from the discussion:

- indexes are mutable and are allowed to be so
- canonical history is append-only
- branches should be preserved if two clients write from the same parent
- one branch may be chosen current automatically for normal reads

## Loading and sync flow

The intended flow is currently:

- local change -> append message -> materialize locally -> project to Pod
- fresh client -> read meta/manifest -> fetch newest bucket indexes first
- list pages load summaries first
- full entities are fetched only when needed or in background
- reconnect or refresh should not require a manual sync action
- notifications may help later, but polling/startup/focus/reconnect should be
  sufficient as the baseline

## Current open design questions

- exact message vocabulary
- whether Pod revisions are always full snapshots or can be shallow patches
- exact RDF shape of meta/manifest/index resources
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
