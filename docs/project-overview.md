# lofipod - Project Overview

**Date:** 2026-04-25
**Type:** library
**Architecture:** framework-agnostic local-first sync engine

## Executive Summary

`lofipod` is an early-stage but already implemented TypeScript library for
building local-first applications that synchronize interoperable RDF data to a
SOLID Pod. The repository is centered on a narrow, testable core rather than a
full application framework: applications define entity types and RDF mappings,
the engine owns local persistence and graph-delta tracking, and optional sync
adapters project canonical data to a Pod in the background.

## Project Classification

- **Repository Type:** monolith
- **Project Type(s):** library
- **Primary Language(s):** TypeScript
- **Architecture Pattern:** layered library with core engine, adapter entrypoints, and Pod sync infrastructure

## Technology Stack Summary

| Category | Technology | Version | Justification |
| --- | --- | --- | --- |
| Language | TypeScript | `^6.0.3` | Main implementation language with strict typing |
| Runtime | Node.js | `>=24` | Development and CI target |
| Packaging | tsup + `tsc` | `^8.3.5` / built-in | Dual ESM/CJS bundles and declaration output |
| Core RDF | `n3` | `^2.0.3` | RDF parsing and serialization |
| Node Storage | `better-sqlite3` | `^12.8.0` | SQLite-backed local storage adapter |
| Browser Storage | IndexedDB | platform API | Browser persistence entrypoint |
| Testing | Vitest | `^4.1.4` | Unit, mocked sync, and integration suites |
| Lint/Format | ESLint, Prettier | current repo config | Enforced code quality and formatting |
| CI/CD | GitHub Actions | workflow files | Verify, build, demo, pod tests, publish |

## Key Features

- typed vocabulary and entity-definition API
- local save, get, list, and delete through an engine API
- append-only local graph-delta log with a materialized read model
- memory, IndexedDB, and SQLite storage adapters
- background sync attach/detach with state inspection
- canonical Turtle entity resources plus N-Triples replication log projection
- bootstrap import from canonical Pod resources
- demo CLI that doubles as an end-to-end regression harness

## Architecture Highlights

- The root `lofipod` package is intentionally environment-neutral.
- Browser-specific storage and Node-specific SQLite/Solid utilities live behind
  `lofipod/browser` and `lofipod/node`.
- Entity definitions are the persistence contract: identity, canonical RDF
  projection, Pod placement, and rehydration are all explicit.
- Sync is asynchronous and queue-based: local writes commit first, then remote
  projection runs in the background.
- The Pod is treated as durable backing storage and replication medium, not the
  primary query database.

## Development Overview

### Prerequisites

- Node.js `24+`
- npm
- Docker for real Pod integration tests

### Getting Started

Install dependencies with `npm ci`, use `npm run verify` as the default local
quality gate, and use the demo CLI or tests to exercise the public API. The
main project documents to read before substantive changes are `README.md`,
`docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, and `docs/WIP.md`.

### Key Commands

- **Install:** `npm ci`
- **Demo:** `npm run demo -- help`
- **Build:** `npm run build`
- **Test:** `npm run verify`

## Repository Structure

The repository is a single package organized around the source library in
`src/`, a demo application in `demo/`, public and planning documents in
`docs/`, and behavior-focused tests in `tests/`. The `_bmad/` and
`_bmad-output/` directories add AI workflow scaffolding and generated planning
artifacts without changing the package runtime architecture.

## Documentation Map

For detailed information, see:

- [index.md](./index.md) - master documentation index
- [architecture.md](./architecture.md) - detailed subsystem architecture
- [source-tree-analysis.md](./source-tree-analysis.md) - annotated directory structure
- [development-guide.md](./development-guide.md) - development workflow and commands

---

_Generated using BMAD Method `document-project` workflow_
