# Story 4.2: Reproject Existing Local Data Into the Updated Model

Status: review

## Story

As a developer changing entity semantics,
I want existing local todo data to be reprojected or repaired into the new supported model,
so that previously stored data remains usable after the change.

## Acceptance Criteria

1. Given local todo data was stored using an earlier supported model and the application now uses an updated supported model, when the engine reads or processes the existing local data through the new model definition, then it can reproject or repair that data into the updated supported shape, and the resulting application-facing entity remains usable through the normal local workflow.
2. Given the updated model implies a different supported canonical or projected interpretation than the previously stored local representation, when the system determines that reprojection or repair is required, then it performs that work through the documented bounded mechanism, and the change is treated as part of the supported local evolution path rather than as silent undefined behavior.
3. Given reprojection or repair changes the effective local representation of a todo entity, when the developer later reads or lists that entity, then the updated result reflects the new supported semantics consistently, and the earlier stored data is not simply abandoned as unreadable.
4. Given a developer is validating how local evolution works in practice, when they review the demo behavior and documentation for this story, then they can understand when reprojection or repair happens, what kind of supported change it covers, and why it preserves local trust, and the explanation remains distinct from broader migration across arbitrary unsupported schema changes.
5. Given the repository is demonstrating safe local evolution rather than one-time upgrade luck, when this story is complete, then developers can see a repeatable example of existing local todo data being brought into the updated model, and that example provides the local foundation for later remote and migration stories.

## Tasks / Subtasks

- [x] Strengthen read-path reprojection behavior for evolved task records through existing repair pathways, not ad hoc migration scripts. (AC: 1, 2)
  - [x] Keep reprojection routed through `repairStoredProjection(...)` semantics in read/list paths.
  - [x] Ensure repaired projection remains deterministic for legacy task records.
- [x] Ensure repaired local entities persist as bounded local evolution changes that remain sync-compatible. (AC: 2, 3)
  - [x] Confirm any required canonical/projection repair is recorded as normal local change behavior, not hidden mutation.
  - [x] Preserve append-only local change history semantics.
- [x] Add behavior-focused regression coverage for legacy local task data reprojected into the updated model. (AC: 1, 3, 5)
  - [x] Cover `get` and `list` read paths after reopening persisted local state.
  - [x] Cover deterministic evolved outputs for legacy records.
- [x] Update demo-facing documentation to explain reprojection/repair boundaries and trust model. (AC: 4, 5)
  - [x] Keep explanation explicitly bounded (supported evolution only; not arbitrary schema/RDF migration).

## Dev Notes

### Epic Context

- Epic 4 goal: safe evolution of data and application semantics without data loss in supported scenarios.
- Story 4.2 is the first explicit reprojection/repair story after 4.1’s baseline local-read continuity.
- Outcome must remain local-first and bounded; full migration orchestration and remote compatibility deepening continue in 4.3-4.4.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1-4.4)]

### Story Foundation and Constraints

- Core remains framework-agnostic and environment-neutral.
- Reprojection/repair must use documented bounded mechanisms, not hidden one-off conversion logic.
- Local reads/lists must remain operational and deterministic for legacy task records.
- Any repair should remain consistent with append-only change tracking and sync expectations.

[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]

### Current State: Relevant UPDATE Files to Read Before Changes

- `src/engine/local.ts`
  - Current state: `getEntity(...)` and `listEntities(...)` call `repairStoredProjection(...)` for each record.
  - 4.2 change target: ensure evolved-model reprojection/repair continues through this bounded read-path mechanism.
  - Must preserve: no direct read-model bypass, no non-transactional hidden rewrites.

- `src/engine/support.ts`
  - Current state: houses projection repair helpers and local engine utilities used by read paths.
  - 4.2 change target: adjust repair semantics only if needed to persist deterministic evolved projections.
  - Must preserve: strict, deterministic behavior and existing storage contracts.

- `demo/entities.ts`
  - Current state: task model now includes `priority`; legacy graphs default to `priority: "normal"`.
  - 4.2 change target: ensure reprojection outcomes for legacy persisted local records are explicit and stable.
  - Must preserve: bounded task model and canonical mapping discipline.

- `demo/app.ts` and `demo/cli.ts`
  - Current state: local CRUD and CLI outputs rely on task projection output.
  - 4.2 change target: keep visible behavior stable while reprojection occurs behind normal reads/lists.
  - Must preserve: local-first UX and existing command semantics.

- `tests/demo-entities.test.ts`, `tests/demo-cli.test.ts`, plus targeted engine/storage tests
  - Current state: coverage exists for legacy task priority default and stable CLI output.
  - 4.2 change target: add explicit reprojection persistence/read-path tests across restart where needed.
  - Must preserve: behavior-focused assertions through public entrypoints.

### Implementation Guardrails

- Do not introduce React or UI-framework assumptions into core or demo engine pathways.
- Do not create separate migration tooling in this story; use existing bounded repair/reprojection paths.
- Do not broaden scope to arbitrary schema evolution or general RDF mutation support.
- Prefer extending existing engine/storage pathways over duplicating logic in demo-specific code.
- Preserve compatibility with subsequent Epic 4 stories (canonical compatibility and migration outcomes).

### Architecture Compliance

- Keep root package environment-neutral (`lofipod`) and runtime-specific concerns in dedicated entrypoints.
- Keep entity definitions as the canonical contract across projection, persistence, and sync.
- If architecture constraints change materially, update `docs/ADR.md`.
- If public API behavior/expectations change, update `docs/API.md`.

### Testing Requirements

Required full gates before completion:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:

- `npx vitest tests/demo-entities.test.ts -t "legacy|priority|project|reproject|repair"`
- `npx vitest tests/demo-cli.test.ts -t "task|get|list|evolution|compat"`
- `npx vitest tests/sqlite-storage.test.ts -t "projection|rehydration|restart|repair"`
- `npx vitest tests/engine.test.ts -t "get|list|projection|repair"`

### Previous Story Intelligence

From Story 4.1:

- `priority` was introduced as a bounded v2 task field.
- Legacy task graphs missing `mlg:priority` already project with default `priority: "normal"`.
- Scope was intentionally limited to read continuity; 4.2 must now make reprojection/repair behavior explicit and repeatable.
- Prior implementation pattern favored small, behavior-first changes and explicit docs alignment.

[Source: `_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md`]

### Git Intelligence Summary

Recent commits:

- `4f52ec8` model evolution
- `23be562` recover from interruptions
- `146c355` explanations of failures
- `12e7e0b` unsafe remote edits
- `6c5ec98` reconcile supported canonical changes

Actionable takeaway: preserve narrow, trust-oriented increments with explicit diagnostics/tests rather than broad rewrites.

### Latest Tech Information (Verified 2026-05-03)

- `typescript` latest on npm: `6.0.3` (matches project pin).
- `vitest` latest on npm: `4.1.5` (project uses `^4.1.4`; keep v4-compatible APIs).
- `n3` latest on npm: `2.0.3` (matches project pin).
- `better-sqlite3` latest on npm: `12.9.0` (project uses `^12.8.0`; no upgrade required for this story).
- Node release line (nodejs.org): v24 is LTS and v25 is Current; project target remains `Node >=24`.

### Project Structure Notes

Primary likely touchpoints:

- `src/engine/local.ts`
- `src/engine/support.ts`
- `demo/entities.ts` (only if additional deterministic projection signaling is needed)
- `tests/demo-entities.test.ts`
- `tests/demo-cli.test.ts`
- optional targeted engine/storage tests (`tests/engine.test.ts`, `tests/sqlite-storage.test.ts`)
- documentation: `demo/README.md`, `docs/API.md`, and `docs/WIP.md` if implementation details shift

Keep this story scoped to local reprojection/repair semantics; do not implement remote canonical migration behavior here.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md`
- `src/engine/local.ts`
- `src/engine/support.ts`
- `demo/entities.ts`
- `demo/app.ts`
- `demo/cli.ts`
- `tests/demo-entities.test.ts`
- `tests/demo-cli.test.ts`
- https://www.npmjs.com/package/typescript
- https://www.npmjs.com/package/vitest
- https://www.npmjs.com/package/n3
- https://www.npmjs.com/package/better-sqlite3
- https://nodejs.org/en/about/releases/

## Story Completion Status

- Story context created with full artifact analysis and implementation guardrails.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved workflow/config and loaded persistent project context facts.
- Auto-selected first backlog story from sprint status: `4-2-reproject-existing-local-data-into-the-updated-model`.
- Loaded and analyzed epics/PRD/architecture and README+ADR+API+PLANS+WIP.
- Read prior story 4.1 for continuity and extracted concrete carry-forward constraints.
- Reviewed relevant implementation/test files for read-path repair and compatibility behavior.
- Collected recent git history to preserve implementation style and risk posture.
- Verified latest ecosystem versions relevant to this story (TypeScript, Vitest, N3, better-sqlite3, Node release line).
- Added failing-first regression tests in `tests/sqlite-storage.test.ts` for legacy task reprojection via `get` and `list` after restart.
- Implemented test-driven assertions validating repaired legacy records remain deterministic (`priority: "normal"`) and that repairs are persisted as normal local changes.
- Updated `demo/README.md` to document that evolved-projection graph repairs are recorded as ordinary local changes for normal sync handling.
- Ran `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` (pod suite rerun succeeded after one transient status assertion mismatch).

### Completion Notes List

- Created Story 4.2 implementation context with AC-to-task mapping.
- Added explicit guardrails to keep reprojection/repair inside existing bounded mechanisms.
- Documented file-level update expectations and preservation constraints.
- Included focused test guidance plus required full validation gates.
- Added previous-story and git intelligence to reduce regression risk.
- Added restart-focused SQLite regression coverage proving legacy task records are reprojected through normal read/list paths.
- Verified repaired legacy records produce deterministic evolved task projections (`priority: "normal"`).
- Verified reprojection results are persisted as normal local changes so they stay sync-compatible.
- Updated demo documentation to clarify bounded reprojection/repair behavior and trust model.

### File List

- _bmad-output/implementation-artifacts/4-2-reproject-existing-local-data-into-the-updated-model.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- demo/README.md
- tests/sqlite-storage.test.ts

## Change Log

- 2026-05-03: Implemented Story 4.2 with restart-safe legacy reprojection regression tests, bounded reprojection/sync-compatibility validation, and demo documentation update. Story moved to `review`.
