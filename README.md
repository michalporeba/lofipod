# lofipod

`lofipod` is a TypeScript library for building apps that work offline first and
sync user-owned data to a SOLID Pod in the background.

It is aimed at developers who want local-first UX, background sync, and
portable data. Applications read and write local state first, while `lofipod`
stores canonical remote data as interoperable RDF resources in the user's Pod.

A SOLID Pod is a user-controlled web data store. RDF is the standard data
format used for the canonical remote representation.

## The problem

Many apps need fast local reads, offline writes, and a UI that keeps working
without a network connection.

At the same time, some apps also need data portability and open storage rather
than keeping everything in an app-specific backend.

`lofipod` is for that combination. It keeps the application local-first while
syncing canonical remote data to interoperable RDF resources in a user's Pod.

## Who it is for

`lofipod` is for developers building apps such as:

- notes and journals
- task and planning tools
- personal knowledge tools
- privacy-sensitive productivity apps

It is most useful when you want:

- local-first behaviour by default
- normal reads and writes to stay local
- background sync rather than manual sync as the main flow
- user-owned data stored in an open format
- a small framework-agnostic core rather than a full app framework

## How it works

1. Define your entity types in TypeScript.
2. Define how each entity maps to RDF.
3. Save and read entities through a local-first API.
4. Keep application queries and lists local.
5. Sync canonical RDF resources and replication data to the user's Pod in the
   background.
6. Recover compatible data from existing canonical Pod resources when needed.

## What it is not

- not a realtime collaborative editor
- not a general-purpose RDF database
- not a general sync engine for arbitrary graphs
- not a UI framework
- not a system that expects Pod-side querying for normal application reads

## Status

`lofipod` is early, but it is no longer only a design repo.

The project currently includes:

- a core public API for defining entities and vocabularies
- typed RDF terms and helper exports for entity mapping
- environment-specific entrypoints for browser and Node adapters
- canonical graph projection and rehydration
- mocked sync coverage for canonical Pod files and replication logs
- explicit bootstrap import from canonical Pod resources on first attach
- focused Community Solid Server integration tests
- a small CLI demo app that acts as an end-to-end regression harness

Expect the API to keep evolving while the core model is being proven.

## Install

```bash
npm install lofipod
```

Current entrypoints:

- `lofipod`: framework-agnostic core
- `lofipod/browser`: browser-specific adapters such as IndexedDB
- `lofipod/node`: Node-specific adapters such as SQLite and the Solid adapter

Node.js `24+` is the current supported runtime target for development and CI.

## Quick Start

The smallest useful flow is:

1. define a vocabulary
2. define one entity type and its RDF mapping
3. create an engine
4. save and read entities locally
5. attach Pod sync when you want remote durability and replication

See [QUICKSTART.md](QUICKSTART.md) for a small end-to-end example using
`defineVocabulary(...)`, `defineEntity<T>(...)`, and `createEngine(...)`.

## Project Docs

- [QUICKSTART.md](QUICKSTART.md): first-use example
- [API.md](API.md): current public API direction
- [ADR.md](ADR.md): accepted architectural decisions
- [TESTING.md](TESTING.md): testing approach, commands, and coverage guardrails
- [PLANS.md](PLANS.md): delivery slices
- [WIP.md](WIP.md): current implementation state and open questions
- [demo/README.md](demo/README.md): in-repo demo app area and ontology seed

## Why it exists

There are good browser storage tools and good Solid authentication and Pod
client tools, but there is still a gap between them.

Most local-first libraries do not target SOLID Pods as a durable backing store,
and most Solid tooling does not provide a local-first sync engine with an
application-facing developer experience.

`lofipod` is an attempt to cover that missing middle ground without becoming a
large framework.

## Testing

Common commands:

- `npm test`: fast unit and mocked-sync suite
- `npm run test:coverage`: source coverage report with enforced thresholds
- `npm run test:demo`: CLI demo regression harness
- `npm run test:pod`: focused Community Solid Server integration suite
- `npm run verify`: format, lint, types, and the default fast suite

See [TESTING.md](TESTING.md) for the intended test layering and current
coverage expectations.
