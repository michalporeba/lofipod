# lofipod Architecture

**Date:** 2026-04-25
**Project Type:** library
**Architecture Pattern:** layered local-first engine with adapter boundaries

## Executive Summary

`lofipod` is structured as a framework-agnostic local-first library. The core
entrypoint defines the public entity, vocabulary, engine, RDF, and in-memory
storage surface. Environment-specific persistence and Solid adapter exports are
isolated behind browser and Node entrypoints. Internally, the architecture is
split into four primary layers: definition/RDF helpers, local engine and
storage, remote sync orchestration, and Solid Pod transport/serialization.

## Technology Stack

| Area              | Technologies                                                  |
| ----------------- | ------------------------------------------------------------- |
| Language/runtime  | TypeScript, Node 24+                                          |
| Packaging         | ESM/CJS export map, tsup, `tsc`                               |
| RDF               | `n3`, project RDF helper layer                                |
| Local persistence | memory adapter, IndexedDB adapter, SQLite adapter             |
| Remote sync       | Solid HTTP adapter, Turtle canonical resources, N-Triples log |
| Quality           | Vitest, ESLint, Prettier, GitHub Actions                      |

## Public API Design

The public surface is intentionally small:

- model definition: `defineVocabulary(...)`, `defineEntity<T>(...)`
- engine construction: `createEngine(...)`
- CRUD: `save`, `get`, `list`, `delete`
- sync lifecycle: `attach`, `detach`, `state`, `onStateChange`, `now`, `bootstrap`
- RDF helpers: URI creation, literals, term inspection, scalar value readers
- storage entrypoints:
  - `createMemoryStorage(...)` from `lofipod`
  - `createIndexedDbStorage(...)` from `lofipod/browser`
  - `createSqliteStorage(...)` from `lofipod/node`
- Solid adapter entrypoints:
  - `createSolidPodAdapter(...)` from `lofipod/browser` or `lofipod/node`

The package avoids exposing deep internal modules as an alternate public
surface.

## Core Architecture

### 1. Definition and RDF Layer

- `src/entity.ts` validates that each entity definition provides `kind`,
  `pod.basePath`, `rdfType`, identity, projection, and rehydration hooks.
- `src/vocabulary.ts` and `src/rdf.ts` provide typed RDF helpers and value
  extraction utilities.
- Entity definitions act as the contract between application objects, local
  persistence, and canonical Pod resources.

### 2. Local Engine Layer

- `src/engine.ts` is the main orchestrator.
- It validates entity registrations, selects a storage adapter, wires sync
  state, notification, and polling managers, and exposes CRUD plus sync APIs.
- Local writes commit first through `saveEntity(...)` and `deleteEntity(...)`,
  then queue background sync if remote sync is attached.
- Sync work is serialized through an internal promise queue to avoid overlapping
  cycles.

### 3. Local Persistence Model

- Storage adapters implement a shared transactional interface.
- The local model uses:
  - stored canonical entity graphs
  - projected read-model objects
  - append-only local graph-delta change history
  - sync metadata such as observed remote change IDs and persisted Pod config
- `src/storage/shared.ts` provides cloning and default sync metadata helpers so
  adapters can preserve consistent semantics.

### 4. Sync and Remote Orchestration

- `src/sync.ts` derives sync state and turns local graph deltas into:
  - Pod entity patch requests
  - remote log append requests
- `src/engine/remote.ts` and sibling modules handle:
  - remote push
  - remote pull
  - canonical polling
  - bootstrap import
  - reconciliation and branch handling
- Polling and optional notifications are reliability enhancers around a
  pull-based baseline rather than the correctness model themselves.

### 5. Solid Pod Adapter Layer

- `src/pod/solid.ts` builds the actual adapter using:
  - HTTP helpers from `solid-http.ts`
  - RDF parsing and serialization from `solid-rdf.ts`
  - notification support from `solid-notifications.ts`
- Canonical resources are stored as Turtle files under per-entity directories.
- Replication log entries are written as N-Triples for deterministic parsing.
- The adapter can:
  - patch or create canonical entity resources
  - delete canonical resources
  - append remote log entries
  - list canonical entities
  - check canonical container versions

## Data Architecture

The accepted model is deliberately narrow:

- shallow entities
- primitive scalar values as first-class fields
- limited nested structures via explicit RDF mapping
- immutable change records with assertions and retractions
- mutable indexes/read models derived locally

Remote data is split into:

1. canonical current-state entity files in Turtle
2. app-private replication log entries in N-Triples

This keeps the Pod interoperable while leaving application queries local.

## Source Tree and Responsibilities

- `src/index.ts`: environment-neutral API boundary
- `src/browser.ts`: browser-specific exports
- `src/node.ts`: Node-specific exports
- `src/engine/`: local CRUD, sync lifecycle, polling, bootstrap, reconciliation
- `src/storage/`: memory, IndexedDB, SQLite implementations
- `src/pod/`: Solid HTTP and RDF transport details
- `tests/`: regression coverage across the public surface and real Pod checks
- `demo/`: CLI-first sample app and end-to-end harness

## Testing Strategy

The project favors behavior-focused public API testing:

- fast default suite: `npm test`
- repo quality gate: `npm run verify`
- end-to-end demo regression: `npm run test:demo`
- focused real Pod integration: `npm run test:pod`

The tests exercise CRUD behavior, storage adapters, mocked sync flows,
recanonicalization, Pod adapter RDF handling, and selected real-server paths.

## Deployment and Release Architecture

- CI on push and pull request runs:
  - `npm ci`
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Release publishing is triggered from GitHub Releases and publishes the npm
  package after the same verify/build/test gates pass.

## Architectural Constraints

- Keep the root package framework-agnostic.
- Do not introduce React assumptions into engine or core RDF/storage code.
- Treat SOLID Pods as durable backing store and sync target, not the primary
  read/query engine.
- Preserve the split between core exports and environment-specific entrypoints.
- Update `docs/ADR.md` when accepted architecture changes materially.

---

_Generated using BMAD Method `document-project` workflow_
