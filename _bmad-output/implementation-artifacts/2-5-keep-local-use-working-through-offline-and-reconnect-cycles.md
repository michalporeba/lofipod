# Story 2.5: Keep Local Use Working Through Offline and Reconnect Cycles

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer relying on background sync,
I want the todo demo to continue working locally while sync is interrupted and then resume safely,
so that connectivity problems do not break the app's normal behavior.

## Acceptance Criteria

1. Given Pod sync is attached to the todo demo, when network access or Pod availability is temporarily lost, then the local todo workflow continues to support the documented local CRUD behavior, and the app does not require immediate remote success in order for local operations to complete.
2. Given one or more local todo changes are made while the sync path is unavailable, when those local operations complete, then the local state reflects the changes immediately through the normal local-first read model, and the sync system preserves the information needed to resume remote synchronization later.
3. Given connectivity or Pod availability returns after an interruption, when the supported sync mechanism resumes, then pending local todo changes are retried through the documented background flow, and the resumed behavior remains consistent with the bounded automatic reconciliation policy.
4. Given the sync path experiences interruption and later recovery, when a developer reviews the demo behavior and supporting documentation, then they can understand that offline use and later resumption are normal parts of the product model, and the explanation does not imply that manual sync choreography is required for ordinary use.
5. Given the todo demo is used as a trust proof for background sync, when this story is complete, then the repository demonstrates that connectivity problems degrade to continued local-first behavior rather than application failure, and reconnect behavior is repeatable enough to support testing and later diagnostics stories.

## Tasks / Subtasks

- [x] Prove local-first operation continues while sync is failing. (AC: 1, 2)
  - [x] Add or extend a behavior-focused test that attaches sync, makes the adapter fail, then verifies `save`, `get`, `list`, and `delete` still complete against local state without waiting for remote success.
  - [x] Verify failed background sync leaves local changes pending instead of discarding or partially projecting them.
  - [x] Keep this coverage at the supported public API layer where practical; do not rely only on internal helper tests.
- [x] Prove reconnect retries the preserved pending work automatically. (AC: 2, 3, 5)
  - [x] Add or extend a test that starts in a failing/offline sync state, records pending local changes, restores connectivity, and verifies the existing background retry path projects the pending changes without manual recovery logic beyond the supported flow.
  - [x] Reuse the current polling/backoff and queued sync-cycle architecture rather than adding a parallel reconnect subsystem.
  - [x] Keep the resumed path compatible with the current first-attach/bootstrap and bounded reconciliation behavior from Story 2.4.
- [x] Keep the demo and docs aligned with the offline/reconnect model. (AC: 4, 5)
  - [x] Update demo-facing docs to explain that local use continues during interruptions and that background sync resumes later when connectivity returns.
  - [x] If demo output or supported status wording changes, keep it small and consistent with the existing CLI surface.
  - [x] Avoid implying that developers must manually choreograph sync to preserve ordinary local operation.
- [x] Preserve the narrow scope boundary with Story 2.6. (AC: 4)
  - [x] Do not turn this story into a broad new diagnostics API or rich inspectability surface; only add the minimum behavior or wording needed to make offline/reconnect trustworthy.
  - [x] If existing `sync.state()` / demo status output is enough to prove the scenario, prefer reusing it over adding new public API.
- [x] Validate with the expected repo gates after implementation. (AC: 1-5)
  - [x] Run `npm run verify`.
  - [x] Run `npm run build`.
  - [x] Run `npm run test:demo`.
  - [x] Run `npm run test:pod`.

## Dev Notes

### Story Intent

Story 2.4 established safe first attach and bounded mixed-state reconciliation. Story 2.5 is the next trust slice: prove that once sync is attached, temporary Pod or network failure does not break local-first use, and that the existing background machinery eventually retries preserved work after connectivity returns. This is primarily an engine-behavior-and-proof story, not a new sync architecture story. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:537), [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:458), [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:243)]

### Critical Guardrails

- Keep local CRUD completion independent from immediate remote success. `save(...)` and `delete(...)` already commit locally before background sync is queued; do not regress this into remote-blocking behavior. [Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:183), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:79)]
- Preserve the framework-agnostic, environment-neutral root package. Any demo or Pod specifics stay in demo or adapter layers, not in core exports. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)]
- Reuse the existing queued sync-cycle, polling, and notification-refresh mechanisms. Do not add a second reconnect scheduler or a demo-only retry path. [Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:135), [src/engine/polling.ts](/media/michal/data/code/lofipod/src/engine/polling.ts:12), [src/engine/notifications.ts](/media/michal/data/code/lofipod/src/engine/notifications.ts:20)]
- Do not expand scope into richer diagnostics or new explainability APIs that belong to later stories. Story 2.6 is the explicit inspectability slice. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:560), [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:570)]

### Epic Context

Epic 2 is the background-sync proof track:

- 2.1 attached sync without changing local CRUD.
- 2.2 added canonical todo mapping and Pod projection.
- 2.3 imported Pod-backed canonical data into fresh local state.
- 2.4 handled mixed local/remote state on first attach.
- 2.5 now proves interruption and recovery during ordinary attached use.
- 2.6 and 2.7 follow with inspectability and multi-device consistency.

This story depends on the earlier slices remaining intact and should feed directly into the later diagnostics and multi-device stories. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:537)]

### Current Codebase State

#### `src/engine.ts`

Current state:
- `save(...)` and `delete(...)` commit locally, emit sync-state changes, and queue background sync afterward.
- queued sync cycles continue after failures because the queue swallows prior rejection before scheduling the next attempt.
- background-triggered sync suppresses thrown errors from the caller path while still persisting failure metadata.

What this story should change:
- likely little or no architecture change if current behavior is already correct.
- if a gap is found, fix it in the existing queueing/failure handling path rather than wrapping CRUD in special offline logic.
- ensure tests prove the intended guarantees explicitly.

What must be preserved:
- local-first CRUD latency and behavior.
- serialized sync cycles.
- attach-time startup of polling/notifications and immediate background work.

Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:106)

#### `src/engine/sync-state.ts`

Current state:
- successful sync marks the connection reachable and records `lastSyncedAt`.
- failed sync marks the connection unreachable and records `lastFailedAt` plus a reason.
- derived state already exposes `unconfigured`, `syncing`, `offline`, `pending`, and `idle`.

What this story should change:
- probably no new state model unless a real gap appears in offline/recovery semantics.
- if demo/docs/tests need stronger guarantees, use these existing states rather than inventing a new status taxonomy.

What must be preserved:
- pending work count remains derived from unprojected changes.
- offline state remains a function of recorded failure metadata, not speculative network checks.

Source: [src/engine/sync-state.ts](/media/michal/data/code/lofipod/src/engine/sync-state.ts:16)

#### `src/engine/polling.ts`

Current state:
- sync polling defaults to 30 seconds unless overridden.
- repeated failures increase the retry delay exponentially up to 5 minutes.
- after a successful cycle, the failure streak resets and queued notification refresh can run.

What this story should change:
- only if needed to make retry-after-recovery deterministic and trustworthy.
- prefer proving current behavior with short test poll intervals over redesigning the polling contract.

What must be preserved:
- polling remains the reliability backstop.
- backoff after consecutive failures.
- no overlapping polling loops or stray timers after stop/restart.

Source: [src/engine/polling.ts](/media/michal/data/code/lofipod/src/engine/polling.ts:3)

#### `src/engine/notifications.ts`

Current state:
- container notifications are optional acceleration only.
- notification callback triggers the existing queued sync path.
- after polling-side recovery from failures, subscriptions can be refreshed.

What this story should change:
- avoid depending on notifications for correctness.
- if tests use a polling-only adapter, that is acceptable and aligned with the architecture.

What must be preserved:
- pull-based correctness when subscriptions are absent or fail.
- notification setup remains additive and non-fatal.

Source: [src/engine/notifications.ts](/media/michal/data/code/lofipod/src/engine/notifications.ts:39)

#### `tests/pod-auto-sync.integration.test.ts`

Current state:
- already proves automatic push after local save.
- already proves automatic pull on attach.
- already proves polling-driven remote change discovery without manual `sync.now()`.

What this story should change:
- extend this suite or parallel coverage with an interruption/recovery scenario using the real Solid server or a controlled failing adapter.
- verify pending local writes survive the offline window and are later projected after recovery.

What must be preserved:
- focused integration scope.
- public-API behavior assertions rather than internal timer inspection.

Source: [tests/pod-auto-sync.integration.test.ts](/media/michal/data/code/lofipod/tests/pod-auto-sync.integration.test.ts:63)

#### `tests/demo-pod.integration.test.ts` and `demo/cli.ts`

Current state:
- demo CLI already exposes `sync status`, `sync bootstrap`, and `sync now`.
- Pod integration tests already prove the demo can sync local data and bootstrap remote data.

What this story should change:
- if the demo needs an explicit offline/reconnect proof, add the smallest repeatable scenario possible.
- keep CLI output compact; do not turn the demo into a debugging console.

What must be preserved:
- documented local-first-first narrative.
- small command surface and SQLite-backed restart-safe demo flow.

Source: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:236), [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:132)

### Recommended Implementation Shape

1. Start with a failing test that simulates attached sync failure while local CRUD continues.
2. Prefer a mocked or controlled adapter in `tests/public-api.test.ts` for precise failure/recovery coverage.
3. Add one focused integration proof only if the real Solid server path materially increases confidence beyond the mocked behavior.
4. Update demo docs after behavior is proven, not before.
5. Keep changes centered in existing engine sync orchestration, demo docs, and tests.

### Previous Story Intelligence

- Story 2.4 already documented and implemented bounded automatic reconciliation for first attach; reconnect behavior after interruption must remain compatible with that policy, not bypass it.
- Story 2.4 also expanded bootstrap result/reporting. Story 2.5 should avoid reopening that API unless interruption handling exposes a real defect.
- The implementation sequence has consistently been engine/test/docs together. Continue that pattern rather than adding demo-only logic.

Source: [2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md:1)

### Git Intelligence

Recent commits:
- `444e316` `handle first attach with pre-existing data on both sides`
- `f8dfc3b` `importing pod backed data`
- `849ee61` `ontology mapping`
- `1760afc` `attaching demo to a pod`
- `831603d` `version updates`

Actionable takeaways:
- Epic 2 work is landing as coherent vertical slices: engine + tests + demo/docs + implementation artifact.
- This story should continue that sequence and remain additive to the current sync model.
- No new dependency should be introduced unless a test harness gap truly requires it.

Source: `git log --oneline -5`

### Testing Requirements

- Required local gates for substantive implementation:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prefer a mix of:
  - public API regression coverage for local CRUD during sync failure and later retry
  - focused Pod integration coverage for real reconnect behavior if needed
  - demo-level proof only where the repository narrative needs it

Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:9), [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)

### Latest Technical Information

- Node.js `v24` remains an official LTS line as of April 15, 2026, which stays aligned with the repo's `>=24` runtime baseline for polling/timer-driven tests and CLI behavior.
  Source: https://nodejs.org/ja/about/previous-releases
- Vitest 4's current migration guide still requires Node.js `>=20`, so the repo's Node 24 baseline remains comfortably compatible for retry/polling tests.
  Source: https://main.vitest.dev/guide/migration
- Inrupt's current Node.js authentication guidance still centers the `Session` flow in the Node adapter layer, reinforcing that authentication/runtime concerns must stay out of the framework-agnostic core while testing reconnect behavior.
  Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Project Structure Notes

- Planning architecture artifact under `_bmad-output/planning-artifacts` is absent; the active architecture baseline is [architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1) plus [ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1).
- UX-specific planning artifacts are absent; story framing comes from PRD, epics, and current demo/docs.
- Most likely files to update:
  - `src/engine.ts`
  - `src/engine/sync-state.ts`
  - `src/engine/polling.ts`
  - `tests/public-api.test.ts`
  - `tests/pod-auto-sync.integration.test.ts`
  - `tests/demo-pod.integration.test.ts`
  - `demo/README.md`
  - possibly `demo/cli.ts` if wording/output needs a small alignment tweak

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:537)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:450)
- [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:1)
- [src/engine/sync-state.ts](/media/michal/data/code/lofipod/src/engine/sync-state.ts:1)
- [src/engine/polling.ts](/media/michal/data/code/lofipod/src/engine/polling.ts:1)
- [src/engine/notifications.ts](/media/michal/data/code/lofipod/src/engine/notifications.ts:1)
- [src/engine/remote.ts](/media/michal/data/code/lofipod/src/engine/remote.ts:1)
- [src/engine/remote-push.ts](/media/michal/data/code/lofipod/src/engine/remote-push.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [tests/pod-auto-sync.integration.test.ts](/media/michal/data/code/lofipod/tests/pod-auto-sync.integration.test.ts:1)
- [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /media/michal/data/code/lofipod/_bmad/scripts/resolve_customization.py --skill /media/michal/data/code/lofipod/.agents/skills/bmad-create-story --key workflow`
- `cat README.md`
- `cat docs/ADR.md`
- `cat docs/API.md`
- `cat docs/PLANS.md`
- `cat docs/WIP.md`
- `cat docs/architecture.md`
- `cat docs/TESTING.md`
- `cat _bmad-output/project-context.md`
- `cat _bmad-output/planning-artifacts/epics.md`
- `cat _bmad-output/planning-artifacts/prd.md`
- `cat _bmad-output/implementation-artifacts/sprint-status.yaml`
- `cat _bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md`
- `cat src/engine.ts`
- `cat src/engine/sync-state.ts`
- `cat src/engine/polling.ts`
- `cat src/engine/notifications.ts`
- `cat src/engine/remote.ts`
- `cat src/engine/remote-push.ts`
- `cat tests/pod-auto-sync.integration.test.ts`
- `cat tests/demo-pod.integration.test.ts`
- `git log --oneline -5`
- `npx vitest run tests/public-api.test.ts`
- `npx vitest run --config vitest.pod.config.ts tests/pod-auto-sync.integration.test.ts`
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

### Implementation Plan

- Prove offline local CRUD and pending-change preservation at the public API layer before changing engine code.
- Add one focused Pod integration regression that proves polling-based automatic recovery against the real Solid server path.
- Keep the demo narrative aligned with the existing sync state model instead of adding new diagnostics surface area.

### Completion Notes List

- Created the Story 2.5 implementation artifact with acceptance criteria, implementation guardrails, current-code analysis, testing expectations, and references.
- Scoped the story to reuse existing offline/retry infrastructure instead of introducing new sync architecture.
- Captured the key sequencing constraint: Story 2.5 proves trustworthy interruption/recovery, while Story 2.6 remains the broader inspectability slice.
- Added public API regression coverage that proves local `save`, `get`, `list`, and `delete` continue to work while background sync is offline and that pending changes remain preserved.
- Added Pod integration coverage that proves polling-based background retry projects preserved local changes after temporary Pod failure without manual recovery steps.
- Updated the demo README to explain offline degradation and later background resumption as the normal operating model.
- Verified the story with `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- _bmad-output/implementation-artifacts/2-5-keep-local-use-working-through-offline-and-reconnect-cycles.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- demo/README.md
- tests/pod-auto-sync.integration.test.ts
- tests/public-api.test.ts

## Change Log

- 2026-05-02: Created Story 2.5 with implementation context for offline local use and reconnect recovery.
- 2026-05-02: Added offline CRUD and reconnect retry regression coverage, updated demo guidance, and moved the story to review.
