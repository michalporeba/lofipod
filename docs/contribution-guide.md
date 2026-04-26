# lofipod Contribution Guide

**Date:** 2026-04-25

## Development Standards

The repository expects contributors to work from the documented architecture
instead of inferring project direction from implementation details alone.

Read first:

1. `README.md`
2. `docs/ADR.md`
3. `docs/API.md`
4. `docs/PLANS.md`
5. `docs/WIP.md`

## Core Rules

- Keep the core framework-agnostic.
- Do not introduce React assumptions into the engine core.
- Treat `docs/ADR.md` as the accepted architecture record.
- Treat `docs/API.md` as the developer-facing API draft.
- Keep `docs/PLANS.md` and `docs/WIP.md` concise and factual.
- Update durable docs when API or architecture changes materially.

## Testing Expectations

Reliability is a first-class goal.

- Prefer behavior-focused tests through the public API.
- Avoid coupling tests tightly to internals unless transport behavior requires
  it.
- Use mocks or fakes for most automated tests.
- Keep Community Solid Server integration tests focused.

Before finishing substantive changes, run:

```bash
npm run verify
npm run build
npm run test:demo
npm run test:pod
```

## Code Quality Expectations

- Stay in strict TypeScript.
- Preserve package boundaries between core, browser, and node entrypoints.
- Keep public exports deliberate.
- Favor small, independently testable slices.
- Keep comments concise and durable.

## Recommended Change Process

1. Read the relevant docs and existing tests.
2. Define or update behavior-focused tests first where practical.
3. Implement the smallest API-first slice that solves the problem.
4. Update docs when public behavior or architecture changes.
5. Run the expected local checks.

## Demo and Test Harness

The demo application is part of the regression strategy, not just sample code.
If a change affects user-facing behavior or sync flow, consider whether the
demo CLI and its tests should change too.

---

_Generated using BMAD Method `document-project` workflow_
