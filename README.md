# lofipod

`lofipod` aims to make local-first web applications with SOLID Pod backing feel practical rather than theoretical: 
fast local reads, automatic background synchronisation, partial loading, and a deliberately narrow data model that 
avoids the worst complexity traps of deep graph sync and collaborative ordering.

## Why it exists

There are good JavaScript and TypeScript tools for browser storage, 
and there are good tools for authenticating with and reading from SOLID Pods, 
but there is still a gap between the two. 

Most local-first libraries do not target SOLID Pods as a durable backing store,
and most Solid tooling does not provide a mature local-first sync engine with 
partial hydration, background sync, and a useful application-facing model.

`lofipod` is intended to explore that missing middle ground.

## What it tries to solve

- local-first persistence for browser applications
- SOLID Pod backing and multi-device synchronisation
- efficient loading of recent data without reading the whole dataset
- a shallow entity model that maps cleanly to RDF
- background sync without a user-facing sync button
- a framework-agnostic core that can later be wrapped for React or other UI libraries

## What it does not try to solve

- realtime collaborative editing like Google Docs
- general CRDT support for arbitrary object graphs
- native ordered replicated collections
- arbitrary RDF graph merge semantics
- a full application framework

## Current architecture direction

The current design direction is intentionally narrow:

- TypeScript source, published as JavaScript with type declarations
- browser-first core
- append-only local transaction log
- materialized local read model for normal reads
- shallow entities with primitive scalar properties
- nested objects and small collections treated as opaque atomic values
- optional support for unordered primitive-value sets
- SOLID Pod storage organised with mutable meta/index files and append-only immutable revisions
- bucketed indexes for efficient list loading and newest-first hydration
- background synchronisation on save, startup, focus, reconnect, and polling

## Testing stance

Reliability matters more than internal cleverness.

- test-driven development should be used where practical
- tests should exercise public API behaviour rather than internal implementation details
- most automated tests should use mocks or fakes for speed and determinism
- integration tests should run against Inrupt's Community Solid Server in local Docker

## Status

There is no implementation yet. The current state of the project is the initial definition of the problem, constraints, and development plan.
