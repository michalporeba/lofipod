# Story 3.6: Recover Cleanly From Interrupted or Failed Sync Work

Status: review

## Story

As a developer using lofipod in imperfect network conditions,
I want interrupted or failed sync work to recover through a repeatable supported path,
so that temporary failure does not turn into permanent uncertainty.

## Acceptance Criteria

1. Given sync work has been interrupted or failed because of temporary network, Pod, or related runtime conditions, when the underlying condition clears and the supported recovery path resumes, then the system retries the affected sync work through the documented background mechanism, and recovery remains consistent with the bounded automatic reconciliation model.
2. Given local todo changes were accepted before the interruption occurred, when sync recovery runs later, then those supported local changes are still represented in local state and in the pending or recoverable sync path as appropriate, and the developer is not required to reconstruct the intended changes manually in normal supported cases.
3. Given remote replay or canonical reconciliation was interrupted mid-flow, when recovery resumes through the supported mechanism, then the resulting local and remote understanding converges toward the same deterministic supported outcome, and the system does not depend on hidden operator repair for ordinary transient failures.
4. Given a developer is diagnosing whether a failure was temporary or left unresolved state behind, when they use the documented explanation and recovery path, then they can tell that recovery has resumed, completed, or remains blocked by an exceptional condition, and the recovery behavior stays understandable without requiring internal implementation knowledge.
5. Given Epic 3 is considered complete, when the repository’s trust, diagnostics, and recovery workflow is reviewed together, then the project demonstrates a coherent story for ongoing remote replay, unsafe-change handling, explanation, and clean recovery from interrupted sync work, and that story provides a stable boundary before later schema-evolution and broader interoperability epics.

## Tasks / Subtasks

- [x] Strengthen automatic retry and recovery behavior for transient sync failures without blocking local CRUD paths. (AC: 1, 2)
- [x] Preserve deterministic recovery ordering across push, pull, and canonical reconciliation after interrupted cycles. (AC: 1, 3)
- [x] Ensure pending local changes remain durable and automatically retried after connectivity/Pod recovery. (AC: 2)
- [x] Make recovery state transitions clearly inspectable via `engine.sync.state()` and existing diagnostics/log events. (AC: 4)
- [x] Add behavior-first tests covering interrupted attach/startup/background cycles and subsequent recovery convergence. (AC: 1, 2, 3, 4)
- [x] Update docs/demo guidance so recovery is repeatable from supported workflows only, with no hidden operator steps. (AC: 4, 5)
- [x] Keep scope bounded to transient failure recovery and inspectability; do not expand to unsupported arbitrary merge/repair semantics. (AC: 5)

## Dev Notes

### Epic Context

- Epic 3 target: trust, recovery, and explainability under failure.
- Story 3.3 introduced detection/classification boundaries for unsafe remote changes.
- Story 3.4 introduced explicit policy response metadata for unsupported reconcile outcomes.
- Story 3.5 made sync outcomes explainable (`pending`, `offline`, last failure, unsupported-policy metadata).
- Story 3.6 completes Epic 3 by proving clean, deterministic recovery after interrupted or failed sync work.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.3-3.6)]

### Story Foundation and Constraints

- Recovery must reuse existing background sync architecture:
  - startup sync (`runStartupSyncCycle`)
  - queued sync cycles (`enqueueSyncCycle` + `runSyncNow`)
  - polling retry loop with backoff (`createPollingManager`)
- Preserve local-first guarantee: local writes are accepted first and not blocked by remote reachability.
- Keep recovery semantics deterministic and idempotent for supported shallow-entity flows.
- Keep unsupported remote policy boundaries unchanged; recovery should not silently widen supported reconciliation behavior.

### Current State: Relevant UPDATE Files to Read Before Changes

- `src/engine.ts`
  - Current state: serializes sync work; startup sync persists failures without throwing; background sync swallows surfaced errors but persists failure metadata.
  - 3.6 target: ensure interrupted/failing cycles resume cleanly and predictably once transient issues clear.
  - Must preserve: non-blocking CRUD, queued sync serialization, safe attach/detach lifecycle.

- `src/engine/polling.ts`
  - Current state: periodic polling retry with exponential backoff by `failureStreak`; refreshes notifications after a recovered tick.
  - 3.6 target: confirm retry cadence and recovery path are robust and inspectable after transient failure sequences.
  - Must preserve: bounded backoff cap, cancellable lifecycle, no duplicate overlapping cycles.

- `src/engine/sync-state.ts`
  - Current state: maps persisted metadata + runtime flags to `unconfigured|offline|syncing|idle|pending` plus connection/reconciliation diagnostics.
  - 3.6 target: ensure recovery progression is observable (blocked -> resumed -> completed) through existing sync state signals.
  - Must preserve: stable API shape and deterministic status derivation.

- `src/engine/remote.ts`, `src/engine/remote-push.ts`, `src/engine/remote-pull.ts`, `src/engine/remote-canonical.ts`
  - Current state: sync phases run in deterministic order (push -> pull -> reconcile).
  - 3.6 target: verify interrupted phase failures recover without duplicated/unsafe outcomes and converge on supported results.
  - Must preserve: bounded merge policy, deterministic ordering, no hidden repair side channels.

- `tests/pod-auto-sync.integration.test.ts`
  - Current state: includes polling-based auto-sync and one transient reconnect retry scenario (`temporary Pod outage`).
  - 3.6 target: extend failure/recovery coverage to include interrupted startup/replay/reconcile paths and inspectable recovery progression.
  - Must preserve: behavior-focused assertions and practical runtime bounds.

- `tests/public-api.test.ts`
  - Current state: broad API/sync-state/reconcile/policy behavior coverage.
  - 3.6 target: add assertions proving stable recovery semantics through public API only.

- `demo/README.md`, `docs/API.md`
  - Current state: describe sync state semantics and diagnostics surfaces.
  - 3.6 target: document repeatable recovery path and interpretation of blocked vs recovered sync state.

### Implementation Guardrails

- Do not introduce manual repair APIs for this story; use supported automatic recovery pathways.
- Do not drop or rewrite pending local changes to “fix” failures.
- Avoid introducing new global mutable recovery state when existing metadata/state machines are sufficient.
- Keep diagnostics privacy-safe (no credential/token leakage).
- Prefer small, composable changes that extend existing retry/scheduling behavior.

### Architecture Compliance

- Keep root package framework-agnostic and environment-neutral.
- Keep Node/browser adapter boundaries intact.
- If public API behavior changes materially, update `docs/API.md` in the same change.
- If architecture intent changes materially, update `docs/ADR.md`.

[Source: `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, `docs/WIP.md`, `_bmad-output/project-context.md`]

### Testing Requirements

Required gates before completion:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:

- `npx vitest tests/public-api.test.ts -t "sync state|offline|pending|recovery|retry"`
- `npx vitest tests/pod-auto-sync.integration.test.ts -t "retries pending local changes automatically|polls for remote changes"`
- `npx vitest tests/demo-pod.integration.test.ts`

### Previous Story Intelligence (3.5)

- 3.5 added explicit explainability fields for unsupported outcomes:
  - `sync.state().reconciliation.lastUnsupportedPolicy`
  - `sync.state().reconciliation.lastUnsupportedReason`
- 3.5 preserved existing sync-state contract while extending diagnostics and CLI output.
- 3.6 should leverage this explainability baseline to show recovery progression clearly, not introduce a separate diagnostic model.

[Source: `_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md`]

### Git Intelligence Summary

Recent commits show reliable, incremental sync hardening:

- `146c355` explanations of failures
- `12e7e0b` unsafe remote edits
- `6c5ec98` reconcile supported canonical changes
- `6cf45e2` replay compatible remote changes

Actionable takeaway: continue narrow behavior-first increments; prefer extending existing sync loops/state derivation over introducing new orchestration surfaces.

### Project Structure Notes

- Expected file targets for 3.6:
  - engine recovery and scheduling behavior in `src/engine.ts`, `src/engine/polling.ts`, and related sync modules
  - public API behavior assertions in `tests/public-api.test.ts`
  - Pod integration recovery scenarios in `tests/pod-auto-sync.integration.test.ts` and possibly `tests/demo-pod.integration.test.ts`
  - recovery docs in `docs/API.md` and `demo/README.md`
- Avoid new top-level recovery subsystems.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `src/engine.ts`
- `src/engine/polling.ts`
- `src/engine/sync-state.ts`
- `src/engine/remote.ts`
- `src/engine/remote-push.ts`
- `src/engine/remote-pull.ts`
- `src/engine/remote-canonical.ts`
- `tests/public-api.test.ts`
- `tests/pod-auto-sync.integration.test.ts`
- `tests/demo-pod.integration.test.ts`
- `_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md`

## Story Completion Status

- Story context created with full artifact analysis and implementation guardrails.
- Status set to `ready-for-dev`.
- Completion note: recovery-focused context prepared for deterministic, test-first implementation.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved next backlog story from sprint status: `3-6-recover-cleanly-from-interrupted-or-failed-sync-work`.
- Loaded Epic 3 Story 3.6 acceptance criteria from planning artifacts.
- Loaded previous story (3.5) for continuity and carry-forward constraints.
- Reviewed recovery-related runtime flow in `src/engine.ts`, `src/engine/polling.ts`, and sync-state derivation.
- Reviewed existing Pod auto-sync integration recovery test coverage and identified extension points.
- Reviewed recent git history for implementation patterns and risk boundaries.
- Implemented startup sync serialization through the shared sync queue in `src/engine.ts`.
- Added regression coverage for interrupted startup + manual sync queueing in `tests/public-api.test.ts`.
- Updated recovery guidance in `docs/API.md` and `demo/README.md`.
- Ran required gates: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod`.

### Completion Notes List

- Created Story 3.6 implementation context with AC-to-task mapping.
- Added concrete file-level guidance for recovery, retry, and state inspectability behavior.
- Embedded constraints to preserve local-first guarantees and bounded reconciliation policy.
- Defined verification gates and focused tests aligned with project workflow.
- Serialized startup sync cycles with existing queued sync execution to avoid overlap with manual/background retries.
- Verified deterministic recovery progression remains inspectable via existing sync state and diagnostics surfaces.
- Added behavior-first test proving startup interruption recovery resumes without concurrent sync execution.
- Documented supported transient failure loop for API users and demo users.

### File List

- src/engine.ts
- tests/public-api.test.ts
- docs/API.md
- demo/README.md
- _bmad-output/implementation-artifacts/3-6-recover-cleanly-from-interrupted-or-failed-sync-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-05-03: Implemented deterministic startup-sync queueing, added recovery serialization test coverage, updated recovery documentation, and passed verify/build/demo/pod gates.
