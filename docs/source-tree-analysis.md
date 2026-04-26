# lofipod - Source Tree Analysis

**Date:** 2026-04-25

## Overview

The repository is a single-package TypeScript library with separate areas for
source code, tests, demo assets, project docs, CI, and BMAD workflow support.
The runtime-relevant code is concentrated in `src/`, with the repo's main
structural split being core engine code versus environment- and transport-
specific adapters.

## Complete Directory Structure

```text
lofipod/
├── src/                     # Library source
│   ├── index.ts             # Environment-neutral public entrypoint
│   ├── browser.ts           # Browser entrypoint: IndexedDB + Solid adapter export
│   ├── node.ts              # Node entrypoint: SQLite + Solid adapter export
│   ├── engine/              # Local CRUD orchestration and sync runtime
│   ├── pod/                 # Solid HTTP, RDF, notifications, and adapter code
│   ├── storage/             # Memory, IndexedDB, SQLite storage adapters
│   ├── rdf.ts               # RDF helper API and term utilities
│   ├── vocabulary.ts        # Vocabulary-definition helpers
│   ├── entity.ts            # Entity-definition validation
│   ├── sync.ts              # Sync-state and patch/log request helpers
│   └── types.ts             # Public and internal type surface
├── tests/                   # Public API, storage, Solid, and integration tests
│   └── support/             # Shared fixtures and Solid test server helpers
├── demo/                    # CLI demo and ontology assets
│   └── ontology/            # Demo RDF vocabulary subset
├── docs/                    # Product, architecture, API, planning, and generated docs
├── scripts/                 # Test and ts-node helper scripts
├── .github/workflows/       # CI and npm publish workflows
├── _bmad/                   # BMAD workflow config and scripts
├── _bmad-output/            # Generated BMAD artifacts
├── coverage/                # Generated coverage reports
├── docker-compose.solid.yml # Local Community Solid Server integration stack
└── package.json             # Package manifest and developer scripts
```

## Critical Directories

### `src/`

Primary library implementation.

**Purpose:** package runtime and public API.
**Contains:** public exports, engine orchestration, storage adapters, RDF
helpers, and Solid Pod integration.
**Entry Points:** `src/index.ts`, `src/browser.ts`, `src/node.ts`

### `src/engine/`

Local-first runtime orchestration.

**Purpose:** save/get/list/delete behavior, sync queueing, polling,
notifications, bootstrap, remote pull/push, and sync-state transitions.
**Contains:** `local.ts`, `remote.ts`, `polling.ts`, `notifications.ts`,
`sync-state.ts`, and support helpers.

### `src/storage/`

Local persistence adapters.

**Purpose:** provide interchangeable storage implementations under a shared
transactional contract.
**Contains:** in-memory storage, IndexedDB support, SQLite support, and shared
clone/default metadata helpers.

### `src/pod/`

Solid Pod interoperability layer.

**Purpose:** HTTP access, RDF parsing/serialization, canonical file handling,
replication log formatting, and container notifications.
**Contains:** `solid.ts`, `solid-http.ts`, `solid-rdf.ts`,
`solid-canonical-rdf.ts`, `solid-log-rdf.ts`, `solid-notifications.ts`

### `tests/`

Behavior-focused regression coverage.

**Purpose:** verify the public API, storage behavior, mocked sync flows, demo
regressions, and focused Community Solid Server integrations.
**Contains:** `public-api.test.ts`, storage adapter tests, Solid adapter tests,
demo CLI tests, and Pod integration tests.

### `demo/`

In-repo demonstration application.

**Purpose:** exercise the library end-to-end and act as a regression harness.
**Contains:** CLI shell, app logic, demo entities, and ontology assets.

### `docs/`

Human-oriented project documentation.

**Purpose:** hold accepted architecture, API drafts, roadmap slices, testing
strategy, and generated brownfield docs.
**Contains:** `ADR.md`, `API.md`, `PLANS.md`, `WIP.md`, generated index and
architecture guides.

### `_bmad/` and `_bmad-output/`

AI workflow scaffolding.

**Purpose:** provide BMAD skill configuration, project context, and generated
planning artifacts.
**Contains:** workflow config, manifests, helper scripts, and output folders.

## Entry Points

- **Main Entry:** `src/index.ts`
- **Additional:**
  - `src/browser.ts`: browser-specific exports
  - `src/node.ts`: Node-specific exports
  - `demo/cli.ts`: demo CLI executable entry

## File Organization Patterns

- Public API exports are assembled at entrypoints rather than from deep-import
  convenience paths.
- Engine, storage, and Pod concerns are separated into subsystem directories.
- Tests mostly mirror externally visible capabilities rather than internal file
  structure.
- Docs separate durable truth (`ADR.md`, `API.md`) from active planning and
  generated workflow output.

## Key File Types

### Package and Build Config

- **Pattern:** `package.json`, `tsconfig*.json`, `eslint.config.js`, `vitest*.ts`
- **Purpose:** package metadata, build, lint, and test configuration
- **Examples:** `package.json`, `vitest.config.ts`, `tsconfig.build.json`

### Source Modules

- **Pattern:** `src/**/*.ts`
- **Purpose:** library source and adapters
- **Examples:** `src/engine.ts`, `src/storage/sqlite.ts`, `src/pod/solid.ts`

### Tests

- **Pattern:** `tests/**/*.test.ts`
- **Purpose:** public API, storage, demo, and Solid integration verification
- **Examples:** `tests/public-api.test.ts`, `tests/pod-solid.test.ts`

### Documentation

- **Pattern:** `docs/*.md`, `README.md`, `demo/**/*.md`
- **Purpose:** product, architecture, API, testing, and demo guidance
- **Examples:** `docs/ADR.md`, `docs/TESTING.md`, `demo/README.md`

### CI and Automation

- **Pattern:** `.github/workflows/*.yml`, `_bmad/**/*`
- **Purpose:** GitHub automation and BMAD workflow support
- **Examples:** `.github/workflows/ci.yml`, `_bmad/bmm/config.yaml`

## Asset Locations

No significant binary asset inventory was detected. The repo does include RDF
and demo ontology assets under `demo/ontology/`.

## Configuration Files

- **`package.json`**: package metadata, scripts, export map, and dependencies
- **`tsconfig.json`**: strict TypeScript compiler settings
- **`tsconfig.build.json`**: declaration build config
- **`vitest.config.ts`**: main fast suite config
- **`vitest.pod.config.ts`**: Pod integration test config
- **`eslint.config.js`**: lint rules
- **`docker-compose.solid.yml`**: local Solid server integration environment
- **`_bmad/bmm/config.yaml`**: BMAD module configuration

## Notes for Development

- Avoid pulling browser or Node-only dependencies into the root entrypoint.
- Treat `docs/ADR.md` as the accepted architecture record.
- Run verify/build/demo/pod checks for substantive changes when the environment
  allows.
- The `coverage/` directory is generated output and not part of the authored
  runtime architecture.

---

_Generated using BMAD Method `document-project` workflow_
