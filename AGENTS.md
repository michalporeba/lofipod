# AGENTS

This file gives starting guidance for agents working in `lofipod`.

## Read order

Before making substantive changes, read:

1. `README.md`
2. `ADR.md`
3. `API.md`
4. `PLANS.md`
5. `WIP.md`

## Working rules

- Keep the core framework-agnostic.
- Do not introduce React assumptions into the engine core.
- Treat `ADR.md` as the place for accepted architectural decisions and
  constraints.
- Treat `API.md` as the working draft for the developer-facing public API.
- If the architecture changes materially, update `ADR.md` rather than leaving
  the change implicit.
- Use `PLANS.md` to structure implementation into small, independently testable,
  API-first features.
- Keep `WIP.md` factual and current during active work.

## Testing expectations

- Reliability is a first-class goal.
- Prefer behaviour-focused tests through the public API.
- Avoid coupling tests tightly to internal implementation details.
- Use TDD where practical.
- Prefer mocks or fakes for most automated tests.
- Use Inrupt's Community Solid Server in local Docker for real integration
  checks.
- Keep heavy integration tests focused so CI remains efficient.

## Architecture intent

- local-first transaction log plus materialized read model
- SOLID Pod backing and synchronisation
- shallow entities only in the initial model
- mutable indexes, immutable revisions
- background sync without manual sync as the normal flow

## Notes

- `WIP.md` is for agent memory, not long-term truth.
- `README.md`, `ADR.md`, `API.md`, and `PLANS.md` should stay concise and
  human-readable.
