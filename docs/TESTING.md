# TESTING

This document records the intended testing approach for `lofipod` and the
current coverage expectations.

## Goals

The test suite should optimize for:

- behaviour-focused checks through the public API
- fast feedback for normal development
- high confidence in local persistence and sync behaviour
- a small, focused set of real Solid Pod integration checks

## Test layers

### 1. Unit and mocked-sync tests

Run with:

```bash
npm test
```

This is the default fast suite and should cover most changes. It includes:

- public API CRUD behaviour
- graph projection and repair behaviour
- local storage adapters with fakes or in-memory storage
- mocked Pod sync flows
- branch and conflict reconciliation behaviour

These tests should be the main regression harness for day-to-day work.

### 2. Coverage run

Run with:

```bash
npm run test:coverage
```

Coverage is measured against `src/**/*.ts` and currently enforces minimum
global thresholds for the library source:

- statements: 80%
- branches: 60%
- functions: 85%
- lines: 80%

Entry-point shims such as `src/index.ts`, `src/node.ts`, and `src/browser.ts`
are excluded from coverage thresholds because they are mostly export wiring.

Coverage is a guardrail, not the goal by itself. New tests should still favor
meaningful behaviour and failure modes over line-chasing.

### 3. Demo regression harness

Run with:

```bash
npm run test:demo
```

This exercises the CLI demo as an end-to-end smoke test around the packaged
developer workflow. It is the explicit regression harness for the documented
local-only first-proof path in `demo/README.md`: add, get, list, update, and
delete a task through repeated CLI runs against the same SQLite-backed data
directory.

### 4. Real Pod integration tests

Run with:

```bash
npm run test:pod
```

This starts a local Community Solid Server Docker setup and runs the focused
Pod-backed integration suite. These tests should remain small and deliberate.

### 5. Full local verification

Run with:

```bash
npm run verify
```

This is the normal pre-merge quality gate for formatting, linting,
typechecking, and the default fast test suite.

If a change touches Pod interoperability or real-server behaviour, also run:

```bash
npm run test:integration
```

## Coverage priorities

When adding tests, prioritize:

- public API behaviour before internal helpers
- local-first persistence guarantees
- sync retries, failures, and recovery paths
- bootstrap and canonical reconciliation behaviour
- conflict resolution and branch handling
- adapter-level boundaries such as Pod HTTP requests and storage persistence

## Known gaps to improve over time

The current suite is strong in the core engine and mocked sync paths, but it
is still weaker in:

- Solid notification protocol edge cases
- lower-level RDF parsing/serialization helpers
- SQLite-specific paths compared to memory and IndexedDB
- real-server integration breadth relative to mocked coverage

Those gaps should be addressed with targeted additions rather than a large
number of slow or implementation-coupled tests.
