# lofipod Development Guide

**Date:** 2026-04-25

## Prerequisites

- Node.js `24+`
- npm
- Docker for real Pod integration tests

## Install

```bash
npm ci
```

## Local Development Workflow

### Read First

Before making substantive changes, read:

1. `README.md`
2. `docs/ADR.md`
3. `docs/API.md`
4. `docs/PLANS.md`
5. `docs/WIP.md`

### Core Working Rules

- Keep the core framework-agnostic.
- Do not introduce React assumptions into the engine core.
- Treat `docs/ADR.md` as accepted architectural truth.
- Treat `docs/API.md` as the working draft of the public API.
- Update `docs/ADR.md` when architecture changes materially.
- Keep implementation slices small, independently testable, and API-first.

## Common Commands

### Demo

```bash
npm run demo -- help
```

### Fast Quality Gate

```bash
npm run verify
```

This runs formatting checks, linting, type-checking, and the default fast test
suite.

### Build

```bash
npm run build
```

### End-to-End Demo Regression

```bash
npm run test:demo
```

### Real Pod Integration Checks

```bash
npm run test:pod
```

### Coverage

```bash
npm run test:coverage
```

## Test Strategy

Prefer behavior-focused tests through the public API. The main layers are:

- `npm test`: default unit and mocked-sync suite
- `npm run test:coverage`: coverage report with thresholds
- `npm run test:demo`: CLI demo regression harness
- `npm run test:pod`: Community Solid Server integration suite

For substantive changes, the expected local checks are:

```bash
npm run verify
npm run build
npm run test:demo
npm run test:pod
```

## Project Layout for Developers

- `src/`: runtime library code
- `tests/`: behavior-focused tests
- `demo/`: CLI demo and ontology assets
- `docs/`: architecture, API, planning, and generated docs
- `scripts/`: helper scripts for demo and Pod tests

## Environment and Packaging Notes

- The root package exports only environment-neutral code.
- Browser-specific exports come from `lofipod/browser`.
- Node-specific exports come from `lofipod/node`.
- Use ESM-style imports with `.js` specifiers in local TypeScript source.

## Common Development Tasks

### Add or Change Core API

1. Update public tests first when practical.
2. Implement the change in `src/`.
3. Keep the root entrypoint environment-neutral.
4. Update `docs/API.md` and, if architecture changed, `docs/ADR.md`.

### Add Storage or Sync Behavior

1. Keep the storage contract behavior consistent across adapters.
2. Add behavior-focused tests.
3. Cover retry, recovery, bootstrap, or reconciliation behavior where relevant.

### Extend Demo Coverage

1. Update demo app logic in `demo/app.ts` or `demo/entities.ts`.
2. Keep CLI shell logic in `demo/cli.ts` thin.
3. Protect the change with `tests/demo-cli.test.ts` and `npm run test:demo`.

## Notes

- `coverage/` is generated output, not authored source.
- Docker is only required for real Pod tests, not for the normal fast suite.
- BMAD output lives under `_bmad-output/` and does not alter runtime packaging.

---

_Generated using BMAD Method `document-project` workflow_
