# Story 4.5: Inspect and Explain Migration Outcomes

Status: done

## Story

As a developer validating an upgrade,
I want to inspect what was migrated, repaired, or left unchanged,
so that I can trust the result of model evolution.

## Acceptance Criteria

1. Given a supported model evolution step has triggered reprojection, repair, or migration work, when the developer inspects the resulting state through the supported explanation surface, then they can tell which todo data was migrated, which was repaired during read or upgrade, and which remained unchanged, and the explanation is specific enough to support confidence in the outcome.
2. Given local and canonical remote data may both participate in the supported evolution path, when the developer reviews migration outcomes, then they can distinguish what happened locally from what happened in the canonical remote representation, and the explanation remains consistent with the documented local-first and canonical-data mental model.
3. Given a supported migration completed successfully, when the developer reviews the explanation and resulting data, then the outcome is presented as a coherent supported transition rather than as hidden internal mechanics, and the explanation helps the developer understand why the evolved data is now valid.
4. Given a migration or repair step encountered an exceptional or incomplete condition, when the developer inspects the result, then that exceptional state is surfaced explicitly rather than buried or implied, and the explanation provides enough context for the developer to understand why trust should be withheld until the condition is resolved.
5. Given the repository is proving that evolution remains understandable, not merely possible, when this story is complete, then developers can see a repeatable example of inspecting migration outcomes in the in-repo workflow, and that example reinforces the project trust model for later adoption and future-reuse work.

## Tasks / Subtasks

- [x] Add migration-outcome inspection coverage in the public developer surface (AC: 1, 2, 3)
- [x] Ensure explanation output separates local outcomes from canonical remote outcomes (AC: 2)
- [x] Ensure successful migrations produce explicit, coherent outcome summaries (AC: 3)
- [x] Ensure exceptional/incomplete migration states are explicit and inspectable (AC: 4)
- [x] Add behavior-focused tests for successful and exceptional inspection paths (AC: 1, 3, 4, 5)
- [x] Update docs/demo guidance to show repeatable migration-outcome inspection workflow (AC: 5)

### Review Findings

- [x] [Review][Decision] Should migration inspectability expose only latest outcomes or a per-entity/history view? — resolved by decision to keep latest-only inspectability for this story scope.
- [x] [Review][Patch] Migration telemetry write in catch can mask original sync failure and skip `persistSyncFailure` [src/engine.ts:127]
- [x] [Review][Patch] Successful replay/reconciliation can be reported as failure if outcome persistence fails post-mutation [src/engine/remote-pull.ts:124]
- [x] [Review][Patch] Story evidence for successful migration explanation is missing in demo/tests (new assertions cover mostly `-` or failure outcomes) [tests/demo-cli.test.ts:46]

## Dev Notes

### Epic Context

- Epic 4 goal is safe data/model evolution with explicit trust boundaries.
- Story 4.4 implemented bounded migration behavior and explicit failure surfacing.
- Story 4.5 now focuses on inspectability and explanation quality for migration outcomes.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Stories 4.4-4.6)]

### Story Foundation and Scope Guardrails

- This story is about explanation and inspectability, not broad new migration mechanics.
- Reuse current migration/reprojection/sync code paths from stories 4.2-4.4.
- Keep outcome reporting aligned with current local-first model and canonical Pod trust model.
- Do not expand into arbitrary schema evolution or generalized foreign-writer migration support.

### Current State: Relevant UPDATE Files

- `src/engine/support.ts`
  - Current state: canonical reprojection and migration failures are surfaced with explicit entity-scoped errors.
  - Story change: add/align inspectable outcome signals for migrated/repaired/unchanged paths.
  - Must preserve: deterministic read/reprojection behavior and no silent fallback.

- `src/engine/remote-pull.ts`
  - Current state: replay/import path surfaces unsupported/incomplete migration failures.
  - Story change: ensure outcomes are explainable to developers and distinguish successful vs exceptional path.
  - Must preserve: replay determinism and existing failure semantics.

- `src/engine/remote-canonical.ts` and `src/engine/supported-merge.ts`
  - Current state: canonical reconciliation classifies and handles supported vs unsupported updates.
  - Story change: expose inspectable migration outcome context consistent with policy boundaries.
  - Must preserve: protective unsupported policy behavior and deterministic classification.

- `src/sync.ts` and sync-state/explanation touchpoints
  - Current state: sync lifecycle and state are inspectable at aggregate level.
  - Story change: ensure migration outcome explanation is coherent with existing sync-state semantics.
  - Must preserve: background sync model and serialized cycle behavior.

- `demo/` CLI and docs (`demo/README.md`, `docs/API.md`, `docs/WIP.md`, optionally `docs/TESTING.md`)
  - Current state: workflow demonstrates migration safety and explicit failure surfacing.
  - Story change: add repeatable migration-outcome inspection example.
  - Must preserve: documented first-run and bounded-scope messaging.

### Architecture Compliance

- Keep root `lofipod` entrypoint framework-agnostic and environment-neutral.
- Keep Node/browser specifics in dedicated entrypoints only.
- Treat canonical Pod Turtle resources as reusable data and app-private N-Triples log as sync infrastructure.
- Keep CRUD local-first and sync background-oriented.

[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]

### Previous Story Intelligence (4.4)

- Use explicit migration failure signaling already introduced; do not add hidden recovery paths.
- Preserve rich diagnostics while keeping entity identity and failure reason clear.
- Prefer behavior-first tests through public API and observable behavior.
- Keep changes narrow and additive; avoid broad refactors for this story.

[Source: `_bmad-output/implementation-artifacts/4-4-migrate-supported-existing-data-without-data-loss.md`]

### Git Intelligence Summary

Recent commits indicate migration/evolution hardening and cleanup in this area:
- `942dc7b` finishign review
- `3befc28` cleanup
- `19471fd` review
- `48dd230` reprojection
- `4f52ec8` model evolution

Actionable implication: preserve the new migration-failure behavior and build inspection/explanation on top of established patterns.

### Library / Framework Requirements (Latest Check: 2026-05-05)

- `typescript`: latest `6.0.3`
- `vitest`: latest `4.1.5`
- `n3`: latest `2.0.3`
- `better-sqlite3`: latest `12.9.0`
- `tsup`: latest `8.5.1`

Use repository-pinned ranges unless this story explicitly includes dependency upgrades.

### Testing Requirements

Required workflow-equivalent checks before completion:
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:
- `npx vitest tests/public-api.test.ts -t "migration|reproject|repair|unsupported|inspect|explain"`
- `npx vitest tests/pod-canonical.integration.test.ts -t "migration|canonical|reconcile"`
- `npx vitest tests/pod-auto-sync.integration.test.ts -t "sync|reconcile|offline|recovery"`
- `npx vitest tests/demo-cli.test.ts -t "task|sync|status|list|get|migration"`

### Project Structure Notes

Likely touchpoints:
- `src/engine/support.ts`
- `src/engine/remote-pull.ts`
- `src/engine/remote-canonical.ts`
- `src/engine/supported-merge.ts`
- `src/sync.ts`
- `tests/public-api.test.ts`
- `tests/pod-canonical.integration.test.ts`
- `tests/pod-auto-sync.integration.test.ts`
- `tests/demo-cli.test.ts`
- `demo/README.md`
- `docs/API.md`
- `docs/WIP.md`

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/4-4-migrate-supported-existing-data-without-data-loss.md`
- `package.json`

## Story Completion Status

- Story implementation completed for Epic 4 Story 4.5.
- Status set to `review`.
- Completion note: Migration outcome inspection and explanation surface implemented and validated.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Workflow customization resolved for `bmad-dev-story`.
- Sprint status read completely; first `ready-for-dev` story selected in order (`4-5-inspect-and-explain-migration-outcomes`).
- Story marked `in-progress` in sprint tracking.
- Added migration outcome structures to sync metadata/state and wired persistence in local reprojection and remote reconciliation/replay paths.
- Added explicit migration-failure outcome capture during sync cycle error handling.
- Updated demo sync status output and docs for migration outcome inspection.
- Added/updated tests in `tests/public-api.test.ts` and `tests/demo-cli.test.ts`.
- Validation runs completed: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod`.

### Completion Notes List

- Implemented new sync-state migration outcome surface: `migration.lastLocalOutcome` and `migration.lastCanonicalRemoteOutcome`.
- Recorded local reprojection outcomes (`repaired`, `unchanged`) and canonical-remote outcomes (`migrated`) with phase/entity/timestamp context.
- Surfaced explicit canonical-remote/local failure outcomes when migration errors occur during sync phases.
- Extended demo `sync status` output with `lastLocalMigrationOutcome` and `lastCanonicalMigrationOutcome`.
- Updated API and demo documentation with the migration outcome inspection model and fields.
- Verified all required quality gates pass, including focused and full regression suites.

### File List

- _bmad-output/implementation-artifacts/4-5-inspect-and-explain-migration-outcomes.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/types.ts
- src/storage/shared.ts
- src/engine/sync-state.ts
- src/engine/support.ts
- src/engine/remote-pull.ts
- src/engine/remote-canonical.ts
- src/engine.ts
- demo/cli.ts
- tests/public-api.test.ts
- tests/demo-cli.test.ts
- docs/API.md
- demo/README.md
- docs/WIP.md

## Change Log

- 2026-05-05: Implemented migration outcome inspection in sync state, added tests and demo/docs updates, and advanced story to review.
