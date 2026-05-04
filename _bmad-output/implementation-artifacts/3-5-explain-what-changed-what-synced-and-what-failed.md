# Story 3.5: Explain What Changed, What Synced, and What Failed

Status: review

## Story

As a developer diagnosing sync behavior,
I want to inspect meaningful sync and state explanations,
so that I can tell what changed locally, what synchronized remotely, and what did not.

## Acceptance Criteria

1. Given the sync-enabled todo demo has processed local changes, remote changes, or failed work, when a developer inspects the supported diagnostics and explanation surface, then they can distinguish local application state, remote canonical state, and sync-related state, and those distinctions are presented consistently with the documented mental model.
2. Given one or more local todo changes have been made, when the developer reviews the available sync explanation, then they can determine which changes have already synchronized, which remain pending, and which failed to synchronize, and the explanation does not require reading hidden internal structures to understand the outcome.
3. Given a supported or unsupported remote change has been detected after attach, when the developer inspects the resulting explanation, then they can tell whether the change was automatically reconciled, classified as unsupported, or handled through a documented policy response, and the explanation remains specific enough to support debugging and trust.
4. Given diagnostics are part of a privacy-respecting local-first product, when explanatory state or logs are exposed to the developer, then they avoid leaking credentials, access tokens, or unnecessary private content by default, and the diagnostic surface remains useful without depending on centralized telemetry.
5. Given the repository is being used as a trust proof for imperfect real-world behavior, when this story is complete, then developers have a concrete, repeatable way to understand what changed, what synced, and what failed in the in-repo workflow, and that understanding supports later recovery work without changing the product’s local-first programming model.

## Tasks / Subtasks

- [x] Extend the supported explanation surface so developers can distinguish local state, sync state, and remote-canonical outcomes via public API and demo output. (AC: 1, 2, 3)
- [x] Keep explanation behavior bounded to existing architecture: local-first CRUD, inspectable sync state, and logger metadata without introducing telemetry or hidden internals. (AC: 1, 4)
- [x] Ensure unsupported remote handling remains explicitly explainable (classification vs policy response) in diagnostics paths. (AC: 3)
- [x] Add or update behavior-first tests for explainability outcomes across success, pending, and failure states. (AC: 1, 2, 3, 5)
- [x] Add/adjust demo-level verification to prove repeatable operator-facing interpretation of “what changed / synced / failed”. (AC: 1, 2, 5)
- [x] Preserve privacy and security guarantees in diagnostic output (no credentials/tokens/private payload leakage). (AC: 4)
- [x] Keep 3.5 scope focused on explanation and inspectability, deferring recovery orchestration mechanics to Story 3.6. (AC: 5)

## Dev Notes

### Epic Context

- Epic 3 target: trust, recovery, and explainability under failure.
- Story 3.3 introduced unsupported/unsafe remote classification.
- Story 3.4 added bounded policy response metadata for unsupported canonical edits (`preserve-local-skip-unsupported-remote`).
- Story 3.5 now makes these outcomes clear and diagnosable for developers using supported inspection surfaces.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.3-3.6)]

### Story Foundation and Constraints

- The explanatory surface must remain tied to existing contract points:
  - `engine.sync.state()`
  - structured logger events (`sync:*`)
  - demo CLI sync status rendering
- Avoid adding hidden/internal-only diagnostics requirements for normal understanding.
- Keep local-first workflow unchanged; explanation should describe behavior, not alter sync semantics.

### Current State: Relevant UPDATE Files to Read Before Changes

- `src/types.ts`
  - Current state: `SyncState` exposes `status`, `configured`, `pendingChanges`, and `connection` (`reachable`, `lastSyncedAt`, `lastFailedAt`, `lastFailureReason`, `notificationsActive`).
  - Story 3.5 change target: if explanation needs additional stable signals, keep any type changes minimal and public-API aligned.
  - Must preserve: narrow API, strict typing, environment-neutral core boundary.

- `src/engine/sync-state.ts`
  - Current state: derives aggregate sync status and persists connection success/failure info.
  - Story 3.5 change target: improve diagnostic clarity while preserving state derivation semantics and status transitions.
  - Must preserve: deterministic status mapping (`unconfigured|offline|syncing|idle|pending`).

- `src/engine.ts`
  - Current state: sync attach/detach lifecycle, queued background sync, success/failure metadata persistence, and logger events (`sync:failure`, `sync:startup-failure`, etc.).
  - Story 3.5 change target: ensure explanation pathways remain consistent and inspectable across startup/background/manual sync cycles.
  - Must preserve: serialized sync behavior and non-blocking local CRUD.

- `src/engine/remote.ts`
  - Current state: logs phase-level sync timings for push/pull/reconcile and cycle duration.
  - Story 3.5 change target: maintain phase-level interpretability and avoid ambiguity between local pending and remote reconciliation outcomes.
  - Must preserve: push→pull→reconcile sequencing.

- `src/engine/remote-canonical.ts`
  - Current state: supported reconciliation/import/delete flows and unsupported classification warning with policy metadata.
  - Story 3.5 change target: ensure explainability clearly distinguishes supported reconcile vs unsupported-policy skip.
  - Must preserve: safe no-overwrite behavior for unsupported canonical edits.

- `demo/cli.ts`
  - Current state: `sync status` prints compact sync-state lines including pending count and last failure reason.
  - Story 3.5 change target: keep output concise but sufficiently explanatory for “changed/synced/failed” interpretation.
  - Must preserve: stable CLI output style and zero secret leakage.

- `demo/README.md`
  - Current state: documents sync inspection semantics and unsupported policy signal.
  - Story 3.5 change target: align examples and explanations with implemented diagnostics behavior.
  - Must preserve: local-first mental model clarity.

- `tests/public-api.test.ts`
  - Current state: broad sync-state, retry, reconcile, and unsupported-policy behavior coverage.
  - Story 3.5 change target: add behavior-first assertions focused on explanation semantics and differentiating outcomes.
  - Must preserve: public-API-first testing style.

- `tests/demo-cli.test.ts` and `tests/demo-pod.integration.test.ts`
  - Current state: validates CLI sync status formatting and Pod-backed diagnostic behavior.
  - Story 3.5 change target: strengthen repeatable interpretation checks for success/pending/failure narratives.
  - Must preserve: deterministic output checks and efficient runtime.

### Implementation Guardrails

- Reuse existing state and logging mechanisms; do not create parallel diagnostics stacks.
- Keep outputs actionable for humans and LLM builders without requiring deep internal knowledge.
- Separate explicitly:
  - local pending changes
  - successful remote sync completion
  - failed or blocked sync outcomes
  - unsupported remote classification/policy handling
- Do not leak authorization headers, tokens, Pod credentials, or private payload details in logs or CLI explanations.

### Architecture Compliance

- Keep core framework-agnostic and environment-neutral (`lofipod` root).
- Keep Node/browser specifics in dedicated entrypoints; demo may use Node adapter but must not contaminate core exports.
- If material API changes occur, update `docs/API.md` in the same change.
- If architecture intent changes materially, update `docs/ADR.md`.

[Source: `docs/architecture.md`, `docs/ADR.md`, `docs/API.md`, `_bmad-output/project-context.md`]

### Testing Requirements

Required gates before completion:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:

- `npx vitest tests/public-api.test.ts -t "sync state|pending|failure|unsupported|policy"`
- `npx vitest tests/demo-cli.test.ts`
- `npx vitest tests/demo-pod.integration.test.ts`

### Previous Story Intelligence (3.4)

- 3.4 established explicit policy metadata for unsupported canonical reconcile events:
  - `policy: "preserve-local-skip-unsupported-remote"`
- Reused centralized merge classifier (`src/engine/supported-merge.ts`), avoiding duplicate conflict logic.
- Maintained local-state safety by skipping unsupported imports/reconciliations.
- Added docs + tests proving deterministic repeated behavior.

3.5 should build on this by improving operator/developer explainability, not by redefining policy logic.

[Source: `_bmad-output/implementation-artifacts/3-4-apply-documented-policy-responses-to-unsupported-remote-changes.md`]

### Git Intelligence Summary

Recent commit pattern:

- `12e7e0b` unsafe remote edits (policy metadata, docs, tests)
- `6c5ec98` supported canonical reconcile work
- `6cf45e2` compatible remote replay
- `bd534a6` multi-device setup
- `01bc19f` inspectable sync state

Actionable takeaway: continue narrow, behavior-first increments with strong diagnostics-focused tests and minimal API surface drift.

### Latest Tech Information (May 3, 2026)

- Node.js release guidance continues to recommend production use of Active LTS or Maintenance LTS lines.
- Vitest 4 migration guidance confirms prerequisites remain `Node >= 20` and `Vite >= 6`; current project baseline (`Node >= 24`) is compatible.
- Inrupt docs continue to center Session-based auth flows for `@inrupt/solid-client-authn-node`, consistent with current adapter-boundary design.
- Inrupt JavaScript client library docs continue to state Node support aligned to Active/Maintenance LTS.

Sources:
- https://nodejs.org/en/about/previous-releases
- https://main.vitest.dev/guide/migration
- https://docs.inrupt.com/guides/authentication-in-solid/authentication-server-side
- https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-shared/
- https://docs.inrupt.com/developer-tools/javascript/client-libraries/reference/solid-client-access-grants/

### Project Structure Notes

- Keep 3.5 work in existing modules:
  - core sync status and orchestration (`src/engine/*`, `src/types.ts`)
  - demo explanation surface (`demo/cli.ts`, `demo/README.md`)
  - behavior checks (`tests/public-api.test.ts`, `tests/demo-*.test.ts`)
- Avoid creating new top-level diagnostics subsystems.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `src/types.ts`
- `src/engine.ts`
- `src/engine/sync-state.ts`
- `src/engine/remote.ts`
- `src/engine/remote-canonical.ts`
- `demo/cli.ts`
- `demo/app.ts`
- `demo/README.md`
- `tests/public-api.test.ts`
- `tests/demo-cli.test.ts`
- `tests/demo-pod.integration.test.ts`

## Story Completion Status

- Story context created with full artifact analysis and implementation guardrails.
- Status aligned to `review`.
- Completion note: Context and implementation records captured for review handoff.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved `bmad-create-story` workflow customization and loaded persistent context.
- Loaded full sprint status and selected first backlog story `3-5-explain-what-changed-what-synced-and-what-failed`.
- Loaded planning artifacts (`epics.md`, `prd.md`), architecture fallback (`docs/architecture.md`), and project context.
- Loaded previous story (3.4) for continuity and extracted implementation learnings.
- Reviewed recent git commits and changed files to preserve conventions and avoid duplication.
- Analyzed current explanation surfaces and update candidates in core sync + demo files.
- Verified latest platform/tooling guidance from Node.js, Vitest, and Inrupt docs.
- Executed `bmad-dev-story` workflow activation and loaded full sprint + story context for Story 3.5.
- Updated sprint story status to `in-progress` before implementation.
- RED phase test updates:
  - Extended `tests/demo-cli.test.ts` to require unsupported-policy explanation lines in `sync status` output (failed as expected before implementation).
  - Extended `tests/public-api.test.ts` expectations to require reconciliation explanation in `sync.state()` for unsupported remote policy outcomes (failed as expected before implementation).
- Implemented explanation-surface extension:
  - Added `reconciliation` shape to `SyncState` and normalized `SyncMetadata` storage defaults/cloning.
  - Wired `readDerivedSyncState(...)` to expose `reconciliation.lastUnsupportedPolicy` and `reconciliation.lastUnsupportedReason`.
  - Persisted unsupported-policy explanation metadata during canonical reconcile classification skips.
  - Extended demo CLI `sync status` output with `lastUnsupportedPolicy` and `lastUnsupportedReason`.
- Updated docs touchpoints (`docs/API.md`, `demo/README.md`) to reflect explanation output.
- Ran focused tests:
  - `npx vitest tests/demo-cli.test.ts`
  - `npx vitest tests/public-api.test.ts -t "deterministic policy response for unsupported post-attach canonical edits"`
- Ran required project gates in the local development session:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`

### Completion Notes List

- Created Story 3.5 with explicit AC-to-task mapping and architecture-safe constraints.
- Added implementation guardrails to keep explanation output bounded, privacy-safe, and deterministic.
- Captured concrete UPDATE-file responsibilities to reduce implementation ambiguity.
- Embedded previous story policy-response intelligence to prevent regression and duplicated logic.
- Included focused and required test gates aligned with project workflow.
- Added a bounded explanation surface to public sync state:
  - `sync.state().reconciliation.lastUnsupportedPolicy`
  - `sync.state().reconciliation.lastUnsupportedReason`
- Ensured unsupported remote outcomes are explicitly inspectable without changing local-first CRUD behavior or introducing telemetry.
- Preserved privacy constraints by exposing only bounded policy/reason diagnostics (no credentials/tokens/private payloads).
- Extended demo `sync status` output so operators can interpret success/failure and unsupported-policy outcomes from a repeatable, documented surface.
- Added/updated behavior-focused tests validating diagnostics output and state explanation coverage.
- Gate command results are not embedded in this artifact; treat this section as an execution log, not machine-verifiable proof.

### File List

- _bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/types.ts
- src/storage/shared.ts
- src/engine/sync-state.ts
- src/engine/remote-canonical.ts
- demo/cli.ts
- demo/README.md
- docs/API.md
- tests/public-api.test.ts
- tests/demo-cli.test.ts
- tests/demo-pod.integration.test.ts

## Change Log

- 2026-05-03: Implemented Story 3.5 explanation-surface improvements for sync diagnostics, including public reconciliation metadata, demo sync status output updates, and behavior-focused test/doc updates.
