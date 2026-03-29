# lofipod

`lofipod` is a local-first TypeScript library for building privacy-first
applications with RDF data and SOLID Pod sync.

It is for applications that want:

- local-first behaviour by default
- usable offline reads and writes
- canonical data stored as interoperable RDF resources
- SOLID Pods as durable backing store and sync target
- a small framework-agnostic core rather than a full app framework

## Status

`lofipod` is early, but it is no longer only a design repo.

The project currently includes:

- a small public API for defining entities and vocabularies
- local persistence with in-memory and IndexedDB adapters
- canonical graph projection and rehydration
- mocked sync coverage for canonical Pod files and replication logs
- focused Community Solid Server integration tests

Expect the API to keep evolving while the core model is being proven.

## What it does

`lofipod` lets application code define entity types, map them to RDF triples,
store them locally first, and later project the same data to SOLID Pods.

The intended flow is:

1. define an entity type and RDF projection
2. save and read entities through a local-first API
3. keep application queries local
4. sync canonical RDF resources and replication data in the background

## What it is not

- not a realtime collaborative editor
- not a general-purpose RDF database
- not a general sync engine for arbitrary graphs
- not a UI framework

## Install

```bash
npm install lofipod
```

Node.js `24+` is the current supported runtime target for development and CI.

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for a small end-to-end example using
`defineVocabulary(...)`, `defineEntity<T>(...)`, and `createEngine(...)`.

## Project Docs

- [QUICKSTART.md](QUICKSTART.md): first-use example
- [API.md](API.md): current public API direction
- [ADR.md](ADR.md): accepted architectural decisions
- [PLANS.md](PLANS.md): delivery slices

## Why it exists

There are good browser storage tools and good Solid authentication and Pod
client tools, but there is still a gap between them.

Most local-first libraries do not target SOLID Pods as a durable backing store,
and most Solid tooling does not provide a local-first sync engine with an
application-facing developer experience.

`lofipod` is an attempt to cover that missing middle ground without becoming a
large framework.
