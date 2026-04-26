# lofipod Component Inventory

**Date:** 2026-04-25

## Overview

This repository does not contain a UI component library. In this project,
"components" are best understood as runtime subsystems, public package surfaces,
and support applications that together make up the developer-facing product.

## Public Package Surfaces

### Core Package: `lofipod`

- **Purpose:** framework-agnostic public API
- **Key Exports:** `defineEntity`, `defineVocabulary`, `createEngine`,
  `createMemoryStorage`, RDF helpers, public types
- **Primary Files:** `src/index.ts`, `src/entity.ts`, `src/vocabulary.ts`,
  `src/rdf.ts`, `src/engine.ts`

### Browser Package Surface: `lofipod/browser`

- **Purpose:** browser-specific adapter entrypoint
- **Key Exports:** everything from core plus `createIndexedDbStorage` and
  `createSolidPodAdapter`
- **Primary Files:** `src/browser.ts`, `src/storage/indexeddb.ts`,
  `src/pod/solid.ts`

### Node Package Surface: `lofipod/node`

- **Purpose:** Node-specific adapter entrypoint
- **Key Exports:** everything from core plus `createSqliteStorage` and
  `createSolidPodAdapter`
- **Primary Files:** `src/node.ts`, `src/storage/sqlite.ts`,
  `src/pod/solid.ts`

## Runtime Subsystems

### Entity and Vocabulary Definition

- **Role:** validate entity definitions and typed vocabulary terms
- **Files:** `src/entity.ts`, `src/vocabulary.ts`
- **Reusability:** shared across all engines and adapters

### RDF Helper Layer

- **Role:** create terms, extract scalar values, and preserve RDF-facing type
  semantics
- **Files:** `src/rdf.ts`
- **Reusability:** shared across entity mapping, tests, and Solid integration

### Engine Orchestration

- **Role:** expose CRUD and sync lifecycle APIs
- **Files:** `src/engine.ts`, `src/engine/local.ts`, `src/engine/support.ts`
- **Notable Responsibilities:** entity registry validation, sync queueing,
  runtime config handling, listener emission

### Sync Runtime

- **Role:** background remote projection, polling, notifications, bootstrap,
  reconciliation, and sync-state tracking
- **Files:** `src/engine/remote.ts`, `src/engine/remote-*.ts`,
  `src/engine/polling.ts`, `src/engine/notifications.ts`,
  `src/engine/sync-state.ts`, `src/sync.ts`

### Storage Adapters

- **Role:** transactional local persistence implementations
- **Files:** `src/storage/memory.ts`, `src/storage/indexeddb.ts`,
  `src/storage/sqlite.ts`, `src/storage/shared.ts`
- **Pattern:** shared semantics with environment-specific implementations

### Solid Pod Adapter

- **Role:** translate sync operations into Solid-compatible HTTP and RDF flows
- **Files:** `src/pod/solid.ts`, `src/pod/solid-http.ts`,
  `src/pod/solid-rdf.ts`, `src/pod/solid-log-rdf.ts`,
  `src/pod/solid-canonical-rdf.ts`, `src/pod/solid-notifications.ts`

## Support Applications

### Demo Application

- **Role:** in-repo example and end-to-end regression harness
- **Files:** `demo/app.ts`, `demo/cli.ts`, `demo/entities.ts`
- **Capabilities:** task and journal entry CRUD plus sync bootstrap/status/now

### Test Support Utilities

- **Role:** shared fixtures and Solid test server setup
- **Files:** `tests/support/*.ts`
- **Capabilities:** event/note fixtures and Community Solid Server helpers

## Quality and Automation Components

### Test Suites

- **Role:** verify behavior through the public API and selected internals where
  transport behavior must be asserted
- **Files:** `tests/*.test.ts`

### CI and Release Workflows

- **Role:** enforce verify/build/test gates and publish releases
- **Files:** `.github/workflows/ci.yml`, `.github/workflows/publish.yml`

### BMAD Workflow Support

- **Role:** provide AI planning and documentation scaffolding
- **Files:** `_bmad/**/*`, `_bmad-output/**/*`

## Reuse Guidance

- Reuse the core package surface for framework-neutral features.
- Put browser persistence behavior behind `lofipod/browser`.
- Put SQLite or Node-specific behavior behind `lofipod/node`.
- Reuse the demo and tests as behavioral examples before extending internal
  helpers directly.

---

_Generated using BMAD Method `document-project` workflow_
