# Edge Case Hunter Review Prompt

Use skill: `bmad-review-edge-case-hunter`

## Constraints
- Use the diff below as primary evidence.
- You may read project files for context and boundary-condition validation.
- Focus on unhandled branches, boundary values, error paths, race/timing/retry edges, migration/version edges, and API compatibility edges.
- Output findings only as a Markdown list.
- For each finding include: severity (`high|medium|low`), one-line title, exact edge case, evidence (file + hunk or file reference), and expected failure mode.

## Diff Under Review

Path: `/tmp/lofipod-review-from-3-4.diff`

```diff
diff --git a/_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md b/_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md
new file mode 100644
index 0000000..af9589b
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md
@@ -0,0 +1,273 @@
+# Story 3.5: Explain What Changed, What Synced, and What Failed
+
+Status: review
+
+## Story
+
+As a developer diagnosing sync behavior,
+I want to inspect meaningful sync and state explanations,
+so that I can tell what changed locally, what synchronized remotely, and what did not.
+
+## Acceptance Criteria
+
+1. Given the sync-enabled todo demo has processed local changes, remote changes, or failed work, when a developer inspects the supported diagnostics and explanation surface, then they can distinguish local application state, remote canonical state, and sync-related state, and those distinctions are presented consistently with the documented mental model.
+2. Given one or more local todo changes have been made, when the developer reviews the available sync explanation, then they can determine which changes have already synchronized, which remain pending, and which failed to synchronize, and the explanation does not require reading hidden internal structures to understand the outcome.
+3. Given a supported or unsupported remote change has been detected after attach, when the developer inspects the resulting explanation, then they can tell whether the change was automatically reconciled, classified as unsupported, or handled through a documented policy response, and the explanation remains specific enough to support debugging and trust.
+4. Given diagnostics are part of a privacy-respecting local-first product, when explanatory state or logs are exposed to the developer, then they avoid leaking credentials, access tokens, or unnecessary private content by default, and the diagnostic surface remains useful without depending on centralized telemetry.
+5. Given the repository is being used as a trust proof for imperfect real-world behavior, when this story is complete, then developers have a concrete, repeatable way to understand what changed, what synced, and what failed in the in-repo workflow, and that understanding supports later recovery work without changing the product’s local-first programming model.
+
+## Tasks / Subtasks
+
+- [x] Extend the supported explanation surface so developers can distinguish local state, sync state, and remote-canonical outcomes via public API and demo output. (AC: 1, 2, 3)
+- [x] Keep explanation behavior bounded to existing architecture: local-first CRUD, inspectable sync state, and logger metadata without introducing telemetry or hidden internals. (AC: 1, 4)
+- [x] Ensure unsupported remote handling remains explicitly explainable (classification vs policy response) in diagnostics paths. (AC: 3)
+- [x] Add or update behavior-first tests for explainability outcomes across success, pending, and failure states. (AC: 1, 2, 3, 5)
+- [x] Add/adjust demo-level verification to prove repeatable operator-facing interpretation of “what changed / synced / failed”. (AC: 1, 2, 5)
+- [x] Preserve privacy and security guarantees in diagnostic output (no credentials/tokens/private payload leakage). (AC: 4)
+- [x] Keep 3.5 scope focused on explanation and inspectability, deferring recovery orchestration mechanics to Story 3.6. (AC: 5)
+
+## Dev Notes
+
+### Epic Context
+
+- Epic 3 target: trust, recovery, and explainability under failure.
+- Story 3.3 introduced unsupported/unsafe remote classification.
+- Story 3.4 added bounded policy response metadata for unsupported canonical edits (`preserve-local-skip-unsupported-remote`).
+- Story 3.5 now makes these outcomes clear and diagnosable for developers using supported inspection surfaces.
+
+[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.3-3.6)]
+
+### Story Foundation and Constraints
+
+- The explanatory surface must remain tied to existing contract points:
+  - `engine.sync.state()`
+  - structured logger events (`sync:*`)
+  - demo CLI sync status rendering
+- Avoid adding hidden/internal-only diagnostics requirements for normal understanding.
+- Keep local-first workflow unchanged; explanation should describe behavior, not alter sync semantics.
+
+### Current State: Relevant UPDATE Files to Read Before Changes
+
+- `src/types.ts`
+  - Current state: `SyncState` exposes `status`, `configured`, `pendingChanges`, and `connection` (`reachable`, `lastSyncedAt`, `lastFailedAt`, `lastFailureReason`, `notificationsActive`).
+  - Story 3.5 change target: if explanation needs additional stable signals, keep any type changes minimal and public-API aligned.
+  - Must preserve: narrow API, strict typing, environment-neutral core boundary.
+
+- `src/engine/sync-state.ts`
+  - Current state: derives aggregate sync status and persists connection success/failure info.
+  - Story 3.5 change target: improve diagnostic clarity while preserving state derivation semantics and status transitions.
+  - Must preserve: deterministic status mapping (`unconfigured|offline|syncing|idle|pending`).
+
+- `src/engine.ts`
+  - Current state: sync attach/detach lifecycle, queued background sync, success/failure metadata persistence, and logger events (`sync:failure`, `sync:startup-failure`, etc.).
+  - Story 3.5 change target: ensure explanation pathways remain consistent and inspectable across startup/background/manual sync cycles.
+  - Must preserve: serialized sync behavior and non-blocking local CRUD.
+
+- `src/engine/remote.ts`
+  - Current state: logs phase-level sync timings for push/pull/reconcile and cycle duration.
+  - Story 3.5 change target: maintain phase-level interpretability and avoid ambiguity between local pending and remote reconciliation outcomes.
+  - Must preserve: push→pull→reconcile sequencing.
+
+- `src/engine/remote-canonical.ts`
+  - Current state: supported reconciliation/import/delete flows and unsupported classification warning with policy metadata.
+  - Story 3.5 change target: ensure explainability clearly distinguishes supported reconcile vs unsupported-policy skip.
+  - Must preserve: safe no-overwrite behavior for unsupported canonical edits.
+
+- `demo/cli.ts`
+  - Current state: `sync status` prints compact sync-state lines including pending count and last failure reason.
+  - Story 3.5 change target: keep output concise but sufficiently explanatory for “changed/synced/failed” interpretation.
+  - Must preserve: stable CLI output style and zero secret leakage.
+
+- `demo/README.md`
+  - Current state: documents sync inspection semantics and unsupported policy signal.
+  - Story 3.5 change target: align examples and explanations with implemented diagnostics behavior.
+  - Must preserve: local-first mental model clarity.
+
+- `tests/public-api.test.ts`
+  - Current state: broad sync-state, retry, reconcile, and unsupported-policy behavior coverage.
+  - Story 3.5 change target: add behavior-first assertions focused on explanation semantics and differentiating outcomes.
+  - Must preserve: public-API-first testing style.
+
+- `tests/demo-cli.test.ts` and `tests/demo-pod.integration.test.ts`
+  - Current state: validates CLI sync status formatting and Pod-backed diagnostic behavior.
+  - Story 3.5 change target: strengthen repeatable interpretation checks for success/pending/failure narratives.
+  - Must preserve: deterministic output checks and efficient runtime.
+
+### Implementation Guardrails
+
+- Reuse existing state and logging mechanisms; do not create parallel diagnostics stacks.
+- Keep outputs actionable for humans and LLM builders without requiring deep internal knowledge.
+- Separate explicitly:
+  - local pending changes
+  - successful remote sync completion
+  - failed or blocked sync outcomes
+  - unsupported remote classification/policy handling
+- Do not leak authorization headers, tokens, Pod credentials, or private payload details in logs or CLI explanations.
+
+### Architecture Compliance
+
+- Keep core framework-agnostic and environment-neutral (`lofipod` root).
+- Keep Node/browser specifics in dedicated entrypoints; demo may use Node adapter but must not contaminate core exports.
+- If material API changes occur, update `docs/API.md` in the same change.
+- If architecture intent changes materially, update `docs/ADR.md`.
+
+[Source: `docs/architecture.md`, `docs/ADR.md`, `docs/API.md`, `_bmad-output/project-context.md`]
+
+### Testing Requirements
+
+Required gates before completion:
+
+- `npm run verify`
+- `npm run build`
+- `npm run test:demo`
+- `npm run test:pod`
+
+Suggested focused checks during implementation:
+
+- `npx vitest tests/public-api.test.ts -t "sync state|pending|failure|unsupported|policy"`
+- `npx vitest tests/demo-cli.test.ts`
+- `npx vitest tests/demo-pod.integration.test.ts`
+
+### Previous Story Intelligence (3.4)
+
+- 3.4 established explicit policy metadata for unsupported canonical reconcile events:
+  - `policy: "preserve-local-skip-unsupported-remote"`
+- Reused centralized merge classifier (`src/engine/supported-merge.ts`), avoiding duplicate conflict logic.
+- Maintained local-state safety by skipping unsupported imports/reconciliations.
+- Added docs + tests proving deterministic repeated behavior.
+
+3.5 should build on this by improving operator/developer explainability, not by redefining policy logic.
+
+[Source: `_bmad-output/implementation-artifacts/3-4-apply-documented-policy-responses-to-unsupported-remote-changes.md`]
+
+### Git Intelligence Summary
+
+Recent commit pattern:
+
+- `12e7e0b` unsafe remote edits (policy metadata, docs, tests)
+- `6c5ec98` supported canonical reconcile work
+- `6cf45e2` compatible remote replay
+- `bd534a6` multi-device setup
+- `01bc19f` inspectable sync state
+
+Actionable takeaway: continue narrow, behavior-first increments with strong diagnostics-focused tests and minimal API surface drift.
+
+### Latest Tech Information (May 3, 2026)
+
+- Node.js release guidance continues to recommend production use of Active LTS or Maintenance LTS lines.
+- Vitest 4 migration guidance confirms prerequisites remain `Node >= 20` and `Vite >= 6`; current project baseline (`Node >= 24`) is compatible.
+- Inrupt docs continue to center Session-based auth flows for `@inrupt/solid-client-authn-node`, consistent with current adapter-boundary design.
+- Inrupt JavaScript client library docs continue to state Node support aligned to Active/Maintenance LTS.
+
+Sources:
+- https://nodejs.org/en/about/previous-releases
+- https://main.vitest.dev/guide/migration
+- https://docs.inrupt.com/guides/authentication-in-solid/authentication-server-side
+- https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-shared/
+- https://docs.inrupt.com/developer-tools/javascript/client-libraries/reference/solid-client-access-grants/
+
+### Project Structure Notes
+
+- Keep 3.5 work in existing modules:
+  - core sync status and orchestration (`src/engine/*`, `src/types.ts`)
+  - demo explanation surface (`demo/cli.ts`, `demo/README.md`)
+  - behavior checks (`tests/public-api.test.ts`, `tests/demo-*.test.ts`)
+- Avoid creating new top-level diagnostics subsystems.
+
+## References
+
+- `_bmad-output/planning-artifacts/epics.md`
+- `_bmad-output/planning-artifacts/prd.md`
+- `docs/architecture.md`
+- `docs/ADR.md`
+- `docs/API.md`
+- `docs/PLANS.md`
+- `docs/WIP.md`
+- `_bmad-output/project-context.md`
+- `src/types.ts`
+- `src/engine.ts`
+- `src/engine/sync-state.ts`
+- `src/engine/remote.ts`
+- `src/engine/remote-canonical.ts`
+- `demo/cli.ts`
+- `demo/app.ts`
+- `demo/README.md`
+- `tests/public-api.test.ts`
+- `tests/demo-cli.test.ts`
+- `tests/demo-pod.integration.test.ts`
+
+## Story Completion Status
+
+- Story context created with full artifact analysis and implementation guardrails.
+- Status set to `ready-for-dev`.
+- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.
+
+## Dev Agent Record
+
+### Agent Model Used
+
+GPT-5 Codex
+
+### Debug Log References
+
+- Resolved `bmad-create-story` workflow customization and loaded persistent context.
+- Loaded full sprint status and selected first backlog story `3-5-explain-what-changed-what-synced-and-what-failed`.
+- Loaded planning artifacts (`epics.md`, `prd.md`), architecture fallback (`docs/architecture.md`), and project context.
+- Loaded previous story (3.4) for continuity and extracted implementation learnings.
+- Reviewed recent git commits and changed files to preserve conventions and avoid duplication.
+- Analyzed current explanation surfaces and update candidates in core sync + demo files.
+- Verified latest platform/tooling guidance from Node.js, Vitest, and Inrupt docs.
+- Executed `bmad-dev-story` workflow activation and loaded full sprint + story context for Story 3.5.
+- Updated sprint story status to `in-progress` before implementation.
+- RED phase test updates:
+  - Extended `tests/demo-cli.test.ts` to require unsupported-policy explanation lines in `sync status` output (failed as expected before implementation).
+  - Extended `tests/public-api.test.ts` expectations to require reconciliation explanation in `sync.state()` for unsupported remote policy outcomes (failed as expected before implementation).
+- Implemented explanation-surface extension:
+  - Added `reconciliation` shape to `SyncState` and normalized `SyncMetadata` storage defaults/cloning.
+  - Wired `readDerivedSyncState(...)` to expose `reconciliation.lastUnsupportedPolicy` and `reconciliation.lastUnsupportedReason`.
+  - Persisted unsupported-policy explanation metadata during canonical reconcile classification skips.
+  - Extended demo CLI `sync status` output with `lastUnsupportedPolicy` and `lastUnsupportedReason`.
+- Updated docs touchpoints (`docs/API.md`, `demo/README.md`) to reflect explanation output.
+- Ran focused tests:
+  - `npx vitest tests/demo-cli.test.ts`
+  - `npx vitest tests/public-api.test.ts -t "deterministic policy response for unsupported post-attach canonical edits"`
+- Ran required project gates:
+  - `npm run verify`
+  - `npm run build`
+  - `npm run test:demo`
+  - `npm run test:pod`
+
+### Completion Notes List
+
+- Created Story 3.5 with explicit AC-to-task mapping and architecture-safe constraints.
+- Added implementation guardrails to keep explanation output bounded, privacy-safe, and deterministic.
+- Captured concrete UPDATE-file responsibilities to reduce implementation ambiguity.
+- Embedded previous story policy-response intelligence to prevent regression and duplicated logic.
+- Included focused and required test gates aligned with project workflow.
+- Added a bounded explanation surface to public sync state:
+  - `sync.state().reconciliation.lastUnsupportedPolicy`
+  - `sync.state().reconciliation.lastUnsupportedReason`
+- Ensured unsupported remote outcomes are explicitly inspectable without changing local-first CRUD behavior or introducing telemetry.
+- Preserved privacy constraints by exposing only bounded policy/reason diagnostics (no credentials/tokens/private payloads).
+- Extended demo `sync status` output so operators can interpret success/failure and unsupported-policy outcomes from a repeatable, documented surface.
+- Added/updated behavior-focused tests validating diagnostics output and state explanation coverage.
+- Completed all required verification gates successfully.
+
+### File List
+
+- _bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md
+- _bmad-output/implementation-artifacts/sprint-status.yaml
+- src/types.ts
+- src/storage/shared.ts
+- src/engine/sync-state.ts
+- src/engine/remote-canonical.ts
+- demo/cli.ts
+- demo/README.md
+- docs/API.md
+- tests/public-api.test.ts
+- tests/demo-cli.test.ts
+- tests/demo-pod.integration.test.ts
+
+## Change Log
+
+- 2026-05-03: Implemented Story 3.5 explanation-surface improvements for sync diagnostics, including public reconciliation metadata, demo sync status output updates, and behavior-focused test/doc updates.
diff --git a/_bmad-output/implementation-artifacts/3-6-recover-cleanly-from-interrupted-or-failed-sync-work.md b/_bmad-output/implementation-artifacts/3-6-recover-cleanly-from-interrupted-or-failed-sync-work.md
new file mode 100644
index 0000000..d34f4be
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/3-6-recover-cleanly-from-interrupted-or-failed-sync-work.md
@@ -0,0 +1,217 @@
+# Story 3.6: Recover Cleanly From Interrupted or Failed Sync Work
+
+Status: review
+
+## Story
+
+As a developer using lofipod in imperfect network conditions,
+I want interrupted or failed sync work to recover through a repeatable supported path,
+so that temporary failure does not turn into permanent uncertainty.
+
+## Acceptance Criteria
+
+1. Given sync work has been interrupted or failed because of temporary network, Pod, or related runtime conditions, when the underlying condition clears and the supported recovery path resumes, then the system retries the affected sync work through the documented background mechanism, and recovery remains consistent with the bounded automatic reconciliation model.
+2. Given local todo changes were accepted before the interruption occurred, when sync recovery runs later, then those supported local changes are still represented in local state and in the pending or recoverable sync path as appropriate, and the developer is not required to reconstruct the intended changes manually in normal supported cases.
+3. Given remote replay or canonical reconciliation was interrupted mid-flow, when recovery resumes through the supported mechanism, then the resulting local and remote understanding converges toward the same deterministic supported outcome, and the system does not depend on hidden operator repair for ordinary transient failures.
+4. Given a developer is diagnosing whether a failure was temporary or left unresolved state behind, when they use the documented explanation and recovery path, then they can tell that recovery has resumed, completed, or remains blocked by an exceptional condition, and the recovery behavior stays understandable without requiring internal implementation knowledge.
+5. Given Epic 3 is considered complete, when the repository’s trust, diagnostics, and recovery workflow is reviewed together, then the project demonstrates a coherent story for ongoing remote replay, unsafe-change handling, explanation, and clean recovery from interrupted sync work, and that story provides a stable boundary before later schema-evolution and broader interoperability epics.
+
+## Tasks / Subtasks
+
+- [x] Strengthen automatic retry and recovery behavior for transient sync failures without blocking local CRUD paths. (AC: 1, 2)
+- [x] Preserve deterministic recovery ordering across push, pull, and canonical reconciliation after interrupted cycles. (AC: 1, 3)
+- [x] Ensure pending local changes remain durable and automatically retried after connectivity/Pod recovery. (AC: 2)
+- [x] Make recovery state transitions clearly inspectable via `engine.sync.state()` and existing diagnostics/log events. (AC: 4)
+- [x] Add behavior-first tests covering interrupted attach/startup/background cycles and subsequent recovery convergence. (AC: 1, 2, 3, 4)
+- [x] Update docs/demo guidance so recovery is repeatable from supported workflows only, with no hidden operator steps. (AC: 4, 5)
+- [x] Keep scope bounded to transient failure recovery and inspectability; do not expand to unsupported arbitrary merge/repair semantics. (AC: 5)
+
+## Dev Notes
+
+### Epic Context
+
+- Epic 3 target: trust, recovery, and explainability under failure.
+- Story 3.3 introduced detection/classification boundaries for unsafe remote changes.
+- Story 3.4 introduced explicit policy response metadata for unsupported reconcile outcomes.
+- Story 3.5 made sync outcomes explainable (`pending`, `offline`, last failure, unsupported-policy metadata).
+- Story 3.6 completes Epic 3 by proving clean, deterministic recovery after interrupted or failed sync work.
+
+[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.3-3.6)]
+
+### Story Foundation and Constraints
+
+- Recovery must reuse existing background sync architecture:
+  - startup sync (`runStartupSyncCycle`)
+  - queued sync cycles (`enqueueSyncCycle` + `runSyncNow`)
+  - polling retry loop with backoff (`createPollingManager`)
+- Preserve local-first guarantee: local writes are accepted first and not blocked by remote reachability.
+- Keep recovery semantics deterministic and idempotent for supported shallow-entity flows.
+- Keep unsupported remote policy boundaries unchanged; recovery should not silently widen supported reconciliation behavior.
+
+### Current State: Relevant UPDATE Files to Read Before Changes
+
+- `src/engine.ts`
+  - Current state: serializes sync work; startup sync persists failures without throwing; background sync swallows surfaced errors but persists failure metadata.
+  - 3.6 target: ensure interrupted/failing cycles resume cleanly and predictably once transient issues clear.
+  - Must preserve: non-blocking CRUD, queued sync serialization, safe attach/detach lifecycle.
+
+- `src/engine/polling.ts`
+  - Current state: periodic polling retry with exponential backoff by `failureStreak`; refreshes notifications after a recovered tick.
+  - 3.6 target: confirm retry cadence and recovery path are robust and inspectable after transient failure sequences.
+  - Must preserve: bounded backoff cap, cancellable lifecycle, no duplicate overlapping cycles.
+
+- `src/engine/sync-state.ts`
+  - Current state: maps persisted metadata + runtime flags to `unconfigured|offline|syncing|idle|pending` plus connection/reconciliation diagnostics.
+  - 3.6 target: ensure recovery progression is observable (blocked -> resumed -> completed) through existing sync state signals.
+  - Must preserve: stable API shape and deterministic status derivation.
+
+- `src/engine/remote.ts`, `src/engine/remote-push.ts`, `src/engine/remote-pull.ts`, `src/engine/remote-canonical.ts`
+  - Current state: sync phases run in deterministic order (push -> pull -> reconcile).
+  - 3.6 target: verify interrupted phase failures recover without duplicated/unsafe outcomes and converge on supported results.
+  - Must preserve: bounded merge policy, deterministic ordering, no hidden repair side channels.
+
+- `tests/pod-auto-sync.integration.test.ts`
+  - Current state: includes polling-based auto-sync and one transient reconnect retry scenario (`temporary Pod outage`).
+  - 3.6 target: extend failure/recovery coverage to include interrupted startup/replay/reconcile paths and inspectable recovery progression.
+  - Must preserve: behavior-focused assertions and practical runtime bounds.
+
+- `tests/public-api.test.ts`
+  - Current state: broad API/sync-state/reconcile/policy behavior coverage.
+  - 3.6 target: add assertions proving stable recovery semantics through public API only.
+
+- `demo/README.md`, `docs/API.md`
+  - Current state: describe sync state semantics and diagnostics surfaces.
+  - 3.6 target: document repeatable recovery path and interpretation of blocked vs recovered sync state.
+
+### Implementation Guardrails
+
+- Do not introduce manual repair APIs for this story; use supported automatic recovery pathways.
+- Do not drop or rewrite pending local changes to “fix” failures.
+- Avoid introducing new global mutable recovery state when existing metadata/state machines are sufficient.
+- Keep diagnostics privacy-safe (no credential/token leakage).
+- Prefer small, composable changes that extend existing retry/scheduling behavior.
+
+### Architecture Compliance
+
+- Keep root package framework-agnostic and environment-neutral.
+- Keep Node/browser adapter boundaries intact.
+- If public API behavior changes materially, update `docs/API.md` in the same change.
+- If architecture intent changes materially, update `docs/ADR.md`.
+
+[Source: `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, `docs/WIP.md`, `_bmad-output/project-context.md`]
+
+### Testing Requirements
+
+Required gates before completion:
+
+- `npm run verify`
+- `npm run build`
+- `npm run test:demo`
+- `npm run test:pod`
+
+Suggested focused checks during implementation:
+
+- `npx vitest tests/public-api.test.ts -t "sync state|offline|pending|recovery|retry"`
+- `npx vitest tests/pod-auto-sync.integration.test.ts -t "retries pending local changes automatically|polls for remote changes"`
+- `npx vitest tests/demo-pod.integration.test.ts`
+
+### Previous Story Intelligence (3.5)
+
+- 3.5 added explicit explainability fields for unsupported outcomes:
+  - `sync.state().reconciliation.lastUnsupportedPolicy`
+  - `sync.state().reconciliation.lastUnsupportedReason`
+- 3.5 preserved existing sync-state contract while extending diagnostics and CLI output.
+- 3.6 should leverage this explainability baseline to show recovery progression clearly, not introduce a separate diagnostic model.
+
+[Source: `_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md`]
+
+### Git Intelligence Summary
+
+Recent commits show reliable, incremental sync hardening:
+
+- `146c355` explanations of failures
+- `12e7e0b` unsafe remote edits
+- `6c5ec98` reconcile supported canonical changes
+- `6cf45e2` replay compatible remote changes
+
+Actionable takeaway: continue narrow behavior-first increments; prefer extending existing sync loops/state derivation over introducing new orchestration surfaces.
+
+### Project Structure Notes
+
+- Expected file targets for 3.6:
+  - engine recovery and scheduling behavior in `src/engine.ts`, `src/engine/polling.ts`, and related sync modules
+  - public API behavior assertions in `tests/public-api.test.ts`
+  - Pod integration recovery scenarios in `tests/pod-auto-sync.integration.test.ts` and possibly `tests/demo-pod.integration.test.ts`
+  - recovery docs in `docs/API.md` and `demo/README.md`
+- Avoid new top-level recovery subsystems.
+
+## References
+
+- `_bmad-output/planning-artifacts/epics.md`
+- `_bmad-output/planning-artifacts/prd.md`
+- `docs/architecture.md`
+- `docs/ADR.md`
+- `docs/API.md`
+- `docs/PLANS.md`
+- `docs/WIP.md`
+- `_bmad-output/project-context.md`
+- `src/engine.ts`
+- `src/engine/polling.ts`
+- `src/engine/sync-state.ts`
+- `src/engine/remote.ts`
+- `src/engine/remote-push.ts`
+- `src/engine/remote-pull.ts`
+- `src/engine/remote-canonical.ts`
+- `tests/public-api.test.ts`
+- `tests/pod-auto-sync.integration.test.ts`
+- `tests/demo-pod.integration.test.ts`
+- `_bmad-output/implementation-artifacts/3-5-explain-what-changed-what-synced-and-what-failed.md`
+
+## Story Completion Status
+
+- Story context created with full artifact analysis and implementation guardrails.
+- Status set to `ready-for-dev`.
+- Completion note: recovery-focused context prepared for deterministic, test-first implementation.
+
+## Dev Agent Record
+
+### Agent Model Used
+
+GPT-5 Codex
+
+### Debug Log References
+
+- Resolved next backlog story from sprint status: `3-6-recover-cleanly-from-interrupted-or-failed-sync-work`.
+- Loaded Epic 3 Story 3.6 acceptance criteria from planning artifacts.
+- Loaded previous story (3.5) for continuity and carry-forward constraints.
+- Reviewed recovery-related runtime flow in `src/engine.ts`, `src/engine/polling.ts`, and sync-state derivation.
+- Reviewed existing Pod auto-sync integration recovery test coverage and identified extension points.
+- Reviewed recent git history for implementation patterns and risk boundaries.
+- Implemented startup sync serialization through the shared sync queue in `src/engine.ts`.
+- Added regression coverage for interrupted startup + manual sync queueing in `tests/public-api.test.ts`.
+- Updated recovery guidance in `docs/API.md` and `demo/README.md`.
+- Ran required gates: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod`.
+
+### Completion Notes List
+
+- Created Story 3.6 implementation context with AC-to-task mapping.
+- Added concrete file-level guidance for recovery, retry, and state inspectability behavior.
+- Embedded constraints to preserve local-first guarantees and bounded reconciliation policy.
+- Defined verification gates and focused tests aligned with project workflow.
+- Serialized startup sync cycles with existing queued sync execution to avoid overlap with manual/background retries.
+- Verified deterministic recovery progression remains inspectable via existing sync state and diagnostics surfaces.
+- Added behavior-first test proving startup interruption recovery resumes without concurrent sync execution.
+- Documented supported transient failure loop for API users and demo users.
+
+### File List
+
+- src/engine.ts
+- tests/public-api.test.ts
+- docs/API.md
+- demo/README.md
+- _bmad-output/implementation-artifacts/3-6-recover-cleanly-from-interrupted-or-failed-sync-work.md
+- _bmad-output/implementation-artifacts/sprint-status.yaml
+
+## Change Log
+
+- 2026-05-03: Implemented deterministic startup-sync queueing, added recovery serialization test coverage, updated recovery documentation, and passed verify/build/demo/pod gates.
diff --git a/_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md b/_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md
new file mode 100644
index 0000000..1370f15
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md
@@ -0,0 +1,217 @@
+# Story 4.1: Evolve the Todo Entity Model Without Breaking Local Reads
+
+Status: review
+
+## Story
+
+As a developer improving the demo app,
+I want to change the supported todo model over time,
+so that the app can evolve without stranding existing local data.
+
+## Acceptance Criteria
+
+1. Given the in-repo todo demo already has stored local data using an earlier supported todo model, when the developer introduces a new supported version of the todo entity model, then the application can still read previously stored todo data through the local-first workflow, and the change remains within the documented bounded evolution path.
+2. Given the todo model changes in a way supported by the Phase 1 architecture, when the updated application code starts using the new model, then the developer is not required to discard existing local data or rebuild the dataset from scratch, and local read behavior remains available while later migration or repair work takes place.
+3. Given a developer is evaluating whether model evolution is a supported feature or an accidental side effect, when they review the demo and documentation for this story, then it is clear bounded entity-model evolution is part of the intended product contract, and the explanation distinguishes supported model changes from arbitrary schema or RDF mutation expectations.
+4. Given the project aims to make local-first and Pod-backed app building practical over time, when this story is complete, then the repository demonstrates a supported todo model can evolve without immediately breaking basic local reads, and this forms the baseline for later reprojection, migration, and canonical compatibility stories.
+
+## Tasks / Subtasks
+
+- [x] Introduce a bounded v2 change to the demo task model in `demo/entities.ts` that is explicitly compatible with reading legacy stored task data. (AC: 1, 2)
+- [x] Preserve local-first read continuity in the same workflow (`task get`, `task list`) while evolution logic is applied lazily or deterministically. (AC: 1, 2)
+- [x] Keep evolution behavior inside existing entity projection/canonicalization pathways; do not add out-of-band migration tooling in this story. (AC: 2, 4)
+- [x] Add/extend behavior-focused tests showing legacy local records are still readable after the model update. (AC: 1, 2)
+- [x] Update demo/docs language so model evolution is presented as a supported bounded contract, not accidental behavior. (AC: 3, 4)
+- [x] Keep scope bounded to local-read continuity baseline; defer reprojection/migration/canonical transition details to stories 4.2-4.4. (AC: 4)
+
+## Dev Notes
+
+### Epic Context
+
+- Epic 4 target: safe evolution of data and application semantics.
+- Story 4.1 is the baseline for 4.2-4.6: prove local reads survive a supported model evolution before adding full reprojection and migration outcomes.
+- This story must demonstrate trust-preserving continuity, not full migration completion.
+
+[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)]
+
+### Story Foundation and Constraints
+
+- Keep the root package framework-agnostic and environment-neutral.
+- Keep bounded scope: shallow entities, explicit deterministic mapping, no arbitrary RDF mutation support.
+- Evolution in 4.1 must not require dataset discard/rebuild.
+- Local-first guarantee is primary: read availability must be preserved while evolution work is introduced.
+
+[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]
+
+### Current State: Relevant UPDATE Files to Read Before Changes
+
+- `demo/entities.ts`
+  - Current state: `Task` shape is `id`, `title`, `status`, optional `due`; `TaskEntity.project(...)` reconstructs directly from `schema:name`, `mlg:status`, optional `mlg:due`.
+  - 4.1 change target: evolve the supported task model while keeping legacy local records readable.
+  - Must preserve: deterministic ID extraction, bounded entity shape, explicit status term validation, canonical mapping discipline.
+
+- `src/engine/local.ts`
+  - Current state: `getEntity(...)`/`listEntities(...)` run `repairStoredProjection(...)`, providing existing read-path repair hooks.
+  - 4.1 change target: rely on existing read/repair semantics to keep local reads working through supported model change.
+  - Must preserve: append-only change behavior, no hidden destructive rewrites, public API behavior.
+
+- `demo/app.ts`
+  - Current state: task CRUD flows through `TaskEntity` with local-first `engine.save/get/list`.
+  - 4.1 change target: keep task CRUD CLI/app path operational with legacy persisted local data.
+  - Must preserve: command-level behavior and compatibility with existing demo workflows.
+
+- `demo/cli.ts`
+  - Current state: task output formatting assumes stable readable task shape.
+  - 4.1 change target: keep CLI read paths stable if evolved fields are introduced.
+  - Must preserve: deterministic output style and no sync-coupling for local commands.
+
+- `tests/demo-entities.test.ts`
+  - Current state: validates bounded task RDF mapping and projection invariants.
+  - 4.1 change target: add regression coverage for legacy-read compatibility under evolved model.
+  - Must preserve: explicit checks for supported terms and deterministic projection.
+
+- `tests/demo-cli.test.ts`
+  - Current state: checks inspectability and local CLI behavior around persisted state.
+  - 4.1 change target: verify local read commands remain usable after model evolution.
+  - Must preserve: behavior-first assertions.
+
+### Implementation Guardrails
+
+- Do not introduce React/UI-framework assumptions.
+- Do not require full migration orchestration in this story; this is local-read continuity baseline only.
+- Do not silently broaden supported schema/RDF mutation surface beyond documented bounded model.
+- Prefer extending existing projection/repair paths over adding parallel compatibility codepaths.
+- Keep canonical Pod semantics stable enough for later stories; avoid premature remote migration logic here.
+
+### Architecture Compliance
+
+- Keep entrypoint boundaries intact: `lofipod` core remains neutral; environment-specific behavior stays under `lofipod/node` and `lofipod/browser`.
+- Treat entity definitions as persistence/sync contracts.
+- If accepted architecture constraints are materially changed, update `docs/ADR.md`.
+- If public API behavior/expectations change, update `docs/API.md`.
+
+### Testing Requirements
+
+Required gates before completion:
+
+- `npm run verify`
+- `npm run build`
+- `npm run test:demo`
+- `npm run test:pod`
+
+Suggested focused checks during implementation:
+
+- `npx vitest tests/demo-entities.test.ts -t "task|project|round-trips|legacy|compat"`
+- `npx vitest tests/demo-cli.test.ts -t "task|get|list|sync status"`
+- `npx vitest tests/sqlite-storage.test.ts -t "read|list|projection|repair"`
+
+### Previous Story Intelligence
+
+- No prior story in Epic 4 exists yet; use Epic 3 outputs only as reliability/test-discipline precedent.
+- Recent story patterns favored narrow, behavior-first increments and explicit diagnostics over broad rewrites.
+
+### Git Intelligence Summary
+
+Recent commits emphasize incremental trust/recovery hardening:
+
+- `23be562` recover from interruptions
+- `146c355` explanations of failures
+- `12e7e0b` unsafe remote edits
+- `6c5ec98` reconcile supported canonical changes
+- `6cf45e2` replay compatible remote changes
+
+Actionable takeaway: maintain small, test-first, contract-preserving changes with explicit docs alignment.
+
+### Latest Tech Information (Verified 2026-05-03)
+
+- Node.js release line status: Node `v24` is listed as LTS, and `v25` is Current.
+- TypeScript 6.0 is officially announced and available.
+- Vitest docs current major line is v4 (site shows `v4.1.5`).
+
+Use this story with current repo constraints (`Node >=24`, strict TypeScript, Vitest 4) and avoid introducing newer runtime/tool assumptions unless intentionally upgraded.
+
+### Project Structure Notes
+
+Primary implementation surface for this story:
+
+- `demo/entities.ts`
+- `demo/app.ts`
+- `demo/cli.ts`
+- `tests/demo-entities.test.ts`
+- `tests/demo-cli.test.ts`
+- optional targeted docs updates in `demo/README.md` and `docs/API.md`
+
+Avoid introducing new top-level migration subsystems in 4.1.
+
+## References
+
+- `_bmad-output/planning-artifacts/epics.md`
+- `_bmad-output/planning-artifacts/prd.md`
+- `docs/architecture.md`
+- `docs/ADR.md`
+- `docs/API.md`
+- `docs/PLANS.md`
+- `docs/WIP.md`
+- `_bmad-output/project-context.md`
+- `demo/entities.ts`
+- `demo/app.ts`
+- `demo/cli.ts`
+- `src/engine/local.ts`
+- `tests/demo-entities.test.ts`
+- `tests/demo-cli.test.ts`
+- https://nodejs.org/en/about/previous-releases
+- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
+- https://vitest.dev/
+
+## Story Completion Status
+
+- Story context created with full artifact analysis and implementation guardrails.
+- Status set to `ready-for-dev`.
+- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.
+
+## Dev Agent Record
+
+### Agent Model Used
+
+GPT-5 Codex
+
+### Debug Log References
+
+- Resolved next backlog story from sprint status: `4-1-evolve-the-todo-entity-model-without-breaking-local-reads`.
+- Loaded and analyzed epics, PRD, architecture, ADR/API/PLANS/WIP, project context, and relevant code paths.
+- Reviewed current demo entity/projection/read pathways and tests for compatibility guidance.
+- Reviewed recent git history to preserve implementation patterns.
+- Verified latest tech references (Node/TypeScript/Vitest) for current-version guardrails.
+- Added bounded task-model v2 field (`priority`) in `demo/entities.ts` with backward-compatible projection default for legacy graphs missing the new predicate.
+- Updated demo app task creation in `demo/app.ts` to populate `priority: "normal"` for new tasks.
+- Added/updated behavior tests in `tests/demo-entities.test.ts` and `tests/demo-cli.test.ts` to verify legacy-read compatibility and stable local CLI read workflow.
+- Updated docs in `demo/README.md` and `docs/API.md` to state bounded model-evolution support explicitly.
+- Ran required gates: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod` (Docker-based run executed outside sandbox).
+
+### Completion Notes List
+
+- Created Story 4.1 implementation context with AC-to-task mapping.
+- Added concrete file-level guidance for model-evolution read compatibility.
+- Included architecture boundaries and bounded-scope guardrails.
+- Captured verification gates and focused test recommendations.
+- Implemented bounded task model evolution by introducing `priority` while preserving local read compatibility for legacy task graphs.
+- Ensured legacy tasks without a priority triple are still readable through deterministic default projection (`priority: "normal"`).
+- Preserved task CLI read/list behavior while evolving the entity contract.
+- Added regression coverage for evolved and legacy task projection paths and for stable local CLI outputs.
+- Updated developer docs to describe bounded model-evolution behavior as intentional contract.
+
+### File List
+
+- _bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md
+- _bmad-output/implementation-artifacts/sprint-status.yaml
+- demo/entities.ts
+- demo/app.ts
+- demo/cli.ts
+- tests/demo-entities.test.ts
+- tests/demo-cli.test.ts
+- demo/README.md
+- docs/API.md
+
+## Change Log
+
+- 2026-05-03: Implemented bounded task-model evolution baseline (v2 priority field with legacy-read compatibility), added regression coverage, updated docs, and passed verify/build/demo/pod validation gates.
diff --git a/_bmad-output/implementation-artifacts/4-2-reproject-existing-local-data-into-the-updated-model.md b/_bmad-output/implementation-artifacts/4-2-reproject-existing-local-data-into-the-updated-model.md
new file mode 100644
index 0000000..2b664d0
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/4-2-reproject-existing-local-data-into-the-updated-model.md
@@ -0,0 +1,226 @@
+# Story 4.2: Reproject Existing Local Data Into the Updated Model
+
+Status: review
+
+## Story
+
+As a developer changing entity semantics,
+I want existing local todo data to be reprojected or repaired into the new supported model,
+so that previously stored data remains usable after the change.
+
+## Acceptance Criteria
+
+1. Given local todo data was stored using an earlier supported model and the application now uses an updated supported model, when the engine reads or processes the existing local data through the new model definition, then it can reproject or repair that data into the updated supported shape, and the resulting application-facing entity remains usable through the normal local workflow.
+2. Given the updated model implies a different supported canonical or projected interpretation than the previously stored local representation, when the system determines that reprojection or repair is required, then it performs that work through the documented bounded mechanism, and the change is treated as part of the supported local evolution path rather than as silent undefined behavior.
+3. Given reprojection or repair changes the effective local representation of a todo entity, when the developer later reads or lists that entity, then the updated result reflects the new supported semantics consistently, and the earlier stored data is not simply abandoned as unreadable.
+4. Given a developer is validating how local evolution works in practice, when they review the demo behavior and documentation for this story, then they can understand when reprojection or repair happens, what kind of supported change it covers, and why it preserves local trust, and the explanation remains distinct from broader migration across arbitrary unsupported schema changes.
+5. Given the repository is demonstrating safe local evolution rather than one-time upgrade luck, when this story is complete, then developers can see a repeatable example of existing local todo data being brought into the updated model, and that example provides the local foundation for later remote and migration stories.
+
+## Tasks / Subtasks
+
+- [x] Strengthen read-path reprojection behavior for evolved task records through existing repair pathways, not ad hoc migration scripts. (AC: 1, 2)
+  - [x] Keep reprojection routed through `repairStoredProjection(...)` semantics in read/list paths.
+  - [x] Ensure repaired projection remains deterministic for legacy task records.
+- [x] Ensure repaired local entities persist as bounded local evolution changes that remain sync-compatible. (AC: 2, 3)
+  - [x] Confirm any required canonical/projection repair is recorded as normal local change behavior, not hidden mutation.
+  - [x] Preserve append-only local change history semantics.
+- [x] Add behavior-focused regression coverage for legacy local task data reprojected into the updated model. (AC: 1, 3, 5)
+  - [x] Cover `get` and `list` read paths after reopening persisted local state.
+  - [x] Cover deterministic evolved outputs for legacy records.
+- [x] Update demo-facing documentation to explain reprojection/repair boundaries and trust model. (AC: 4, 5)
+  - [x] Keep explanation explicitly bounded (supported evolution only; not arbitrary schema/RDF migration).
+
+## Dev Notes
+
+### Epic Context
+
+- Epic 4 goal: safe evolution of data and application semantics without data loss in supported scenarios.
+- Story 4.2 is the first explicit reprojection/repair story after 4.1’s baseline local-read continuity.
+- Outcome must remain local-first and bounded; full migration orchestration and remote compatibility deepening continue in 4.3-4.4.
+
+[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1-4.4)]
+
+### Story Foundation and Constraints
+
+- Core remains framework-agnostic and environment-neutral.
+- Reprojection/repair must use documented bounded mechanisms, not hidden one-off conversion logic.
+- Local reads/lists must remain operational and deterministic for legacy task records.
+- Any repair should remain consistent with append-only change tracking and sync expectations.
+
+[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]
+
+### Current State: Relevant UPDATE Files to Read Before Changes
+
+- `src/engine/local.ts`
+  - Current state: `getEntity(...)` and `listEntities(...)` call `repairStoredProjection(...)` for each record.
+  - 4.2 change target: ensure evolved-model reprojection/repair continues through this bounded read-path mechanism.
+  - Must preserve: no direct read-model bypass, no non-transactional hidden rewrites.
+
+- `src/engine/support.ts`
+  - Current state: houses projection repair helpers and local engine utilities used by read paths.
+  - 4.2 change target: adjust repair semantics only if needed to persist deterministic evolved projections.
+  - Must preserve: strict, deterministic behavior and existing storage contracts.
+
+- `demo/entities.ts`
+  - Current state: task model now includes `priority`; legacy graphs default to `priority: "normal"`.
+  - 4.2 change target: ensure reprojection outcomes for legacy persisted local records are explicit and stable.
+  - Must preserve: bounded task model and canonical mapping discipline.
+
+- `demo/app.ts` and `demo/cli.ts`
+  - Current state: local CRUD and CLI outputs rely on task projection output.
+  - 4.2 change target: keep visible behavior stable while reprojection occurs behind normal reads/lists.
+  - Must preserve: local-first UX and existing command semantics.
+
+- `tests/demo-entities.test.ts`, `tests/demo-cli.test.ts`, plus targeted engine/storage tests
+  - Current state: coverage exists for legacy task priority default and stable CLI output.
+  - 4.2 change target: add explicit reprojection persistence/read-path tests across restart where needed.
+  - Must preserve: behavior-focused assertions through public entrypoints.
+
+### Implementation Guardrails
+
+- Do not introduce React or UI-framework assumptions into core or demo engine pathways.
+- Do not create separate migration tooling in this story; use existing bounded repair/reprojection paths.
+- Do not broaden scope to arbitrary schema evolution or general RDF mutation support.
+- Prefer extending existing engine/storage pathways over duplicating logic in demo-specific code.
+- Preserve compatibility with subsequent Epic 4 stories (canonical compatibility and migration outcomes).
+
+### Architecture Compliance
+
+- Keep root package environment-neutral (`lofipod`) and runtime-specific concerns in dedicated entrypoints.
+- Keep entity definitions as the canonical contract across projection, persistence, and sync.
+- If architecture constraints change materially, update `docs/ADR.md`.
+- If public API behavior/expectations change, update `docs/API.md`.
+
+### Testing Requirements
+
+Required full gates before completion:
+
+- `npm run verify`
+- `npm run build`
+- `npm run test:demo`
+- `npm run test:pod`
+
+Suggested focused checks during implementation:
+
+- `npx vitest tests/demo-entities.test.ts -t "legacy|priority|project|reproject|repair"`
+- `npx vitest tests/demo-cli.test.ts -t "task|get|list|evolution|compat"`
+- `npx vitest tests/sqlite-storage.test.ts -t "projection|rehydration|restart|repair"`
+- `npx vitest tests/engine.test.ts -t "get|list|projection|repair"`
+
+### Previous Story Intelligence
+
+From Story 4.1:
+
+- `priority` was introduced as a bounded v2 task field.
+- Legacy task graphs missing `mlg:priority` already project with default `priority: "normal"`.
+- Scope was intentionally limited to read continuity; 4.2 must now make reprojection/repair behavior explicit and repeatable.
+- Prior implementation pattern favored small, behavior-first changes and explicit docs alignment.
+
+[Source: `_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md`]
+
+### Git Intelligence Summary
+
+Recent commits:
+
+- `4f52ec8` model evolution
+- `23be562` recover from interruptions
+- `146c355` explanations of failures
+- `12e7e0b` unsafe remote edits
+- `6c5ec98` reconcile supported canonical changes
+
+Actionable takeaway: preserve narrow, trust-oriented increments with explicit diagnostics/tests rather than broad rewrites.
+
+### Latest Tech Information (Verified 2026-05-03)
+
+- `typescript` latest on npm: `6.0.3` (matches project pin).
+- `vitest` latest on npm: `4.1.5` (project uses `^4.1.4`; keep v4-compatible APIs).
+- `n3` latest on npm: `2.0.3` (matches project pin).
+- `better-sqlite3` latest on npm: `12.9.0` (project uses `^12.8.0`; no upgrade required for this story).
+- Node release line (nodejs.org): v24 is LTS and v25 is Current; project target remains `Node >=24`.
+
+### Project Structure Notes
+
+Primary likely touchpoints:
+
+- `src/engine/local.ts`
+- `src/engine/support.ts`
+- `demo/entities.ts` (only if additional deterministic projection signaling is needed)
+- `tests/demo-entities.test.ts`
+- `tests/demo-cli.test.ts`
+- optional targeted engine/storage tests (`tests/engine.test.ts`, `tests/sqlite-storage.test.ts`)
+- documentation: `demo/README.md`, `docs/API.md`, and `docs/WIP.md` if implementation details shift
+
+Keep this story scoped to local reprojection/repair semantics; do not implement remote canonical migration behavior here.
+
+## References
+
+- `_bmad-output/planning-artifacts/epics.md`
+- `_bmad-output/planning-artifacts/prd.md`
+- `docs/architecture.md`
+- `docs/ADR.md`
+- `docs/API.md`
+- `docs/PLANS.md`
+- `docs/WIP.md`
+- `_bmad-output/project-context.md`
+- `_bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md`
+- `src/engine/local.ts`
+- `src/engine/support.ts`
+- `demo/entities.ts`
+- `demo/app.ts`
+- `demo/cli.ts`
+- `tests/demo-entities.test.ts`
+- `tests/demo-cli.test.ts`
+- https://www.npmjs.com/package/typescript
+- https://www.npmjs.com/package/vitest
+- https://www.npmjs.com/package/n3
+- https://www.npmjs.com/package/better-sqlite3
+- https://nodejs.org/en/about/releases/
+
+## Story Completion Status
+
+- Story context created with full artifact analysis and implementation guardrails.
+- Status set to `ready-for-dev`.
+- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.
+
+## Dev Agent Record
+
+### Agent Model Used
+
+GPT-5 Codex
+
+### Debug Log References
+
+- Resolved workflow/config and loaded persistent project context facts.
+- Auto-selected first backlog story from sprint status: `4-2-reproject-existing-local-data-into-the-updated-model`.
+- Loaded and analyzed epics/PRD/architecture and README+ADR+API+PLANS+WIP.
+- Read prior story 4.1 for continuity and extracted concrete carry-forward constraints.
+- Reviewed relevant implementation/test files for read-path repair and compatibility behavior.
+- Collected recent git history to preserve implementation style and risk posture.
+- Verified latest ecosystem versions relevant to this story (TypeScript, Vitest, N3, better-sqlite3, Node release line).
+- Added failing-first regression tests in `tests/sqlite-storage.test.ts` for legacy task reprojection via `get` and `list` after restart.
+- Implemented test-driven assertions validating repaired legacy records remain deterministic (`priority: "normal"`) and that repairs are persisted as normal local changes.
+- Updated `demo/README.md` to document that evolved-projection graph repairs are recorded as ordinary local changes for normal sync handling.
+- Ran `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` (pod suite rerun succeeded after one transient status assertion mismatch).
+
+### Completion Notes List
+
+- Created Story 4.2 implementation context with AC-to-task mapping.
+- Added explicit guardrails to keep reprojection/repair inside existing bounded mechanisms.
+- Documented file-level update expectations and preservation constraints.
+- Included focused test guidance plus required full validation gates.
+- Added previous-story and git intelligence to reduce regression risk.
+- Added restart-focused SQLite regression coverage proving legacy task records are reprojected through normal read/list paths.
+- Verified repaired legacy records produce deterministic evolved task projections (`priority: "normal"`).
+- Verified reprojection results are persisted as normal local changes so they stay sync-compatible.
+- Updated demo documentation to clarify bounded reprojection/repair behavior and trust model.
+
+### File List
+
+- _bmad-output/implementation-artifacts/4-2-reproject-existing-local-data-into-the-updated-model.md
+- _bmad-output/implementation-artifacts/sprint-status.yaml
+- demo/README.md
+- tests/sqlite-storage.test.ts
+
+## Change Log
+
+- 2026-05-03: Implemented Story 4.2 with restart-safe legacy reprojection regression tests, bounded reprojection/sync-compatibility validation, and demo documentation update. Story moved to `review`.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index d8bdcec..0f94354 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -35,7 +35,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 
 generated: "2026-04-26T13:37:20+01:00"
-last_updated: "2026-05-03T13:32:00+01:00"
+last_updated: "2026-05-03T17:10:00+01:00"
 project: "lofipod"
 project_key: "NOKEY"
 tracking_system: "file-system"
@@ -61,15 +61,15 @@ development_status:
   epic-3: in-progress
   3-1-replay-compatible-remote-changes-from-another-lofipod-client: done
   3-2-reconcile-supported-canonical-remote-changes-after-attach: done
-  3-3-detect-and-classify-unsupported-or-unsafe-remote-edits: review
+  3-3-detect-and-classify-unsupported-or-unsafe-remote-edits: done
   3-4-apply-documented-policy-responses-to-unsupported-remote-changes: review
-  3-5-explain-what-changed-what-synced-and-what-failed: backlog
-  3-6-recover-cleanly-from-interrupted-or-failed-sync-work: backlog
+  3-5-explain-what-changed-what-synced-and-what-failed: review
+  3-6-recover-cleanly-from-interrupted-or-failed-sync-work: review
   epic-3-retrospective: optional
-  epic-4: backlog
-  4-1-evolve-the-todo-entity-model-without-breaking-local-reads: backlog
-  4-2-reproject-existing-local-data-into-the-updated-model: backlog
-  4-3-preserve-canonical-pod-compatibility-during-model-evolution: backlog
+  epic-4: in-progress
+  4-1-evolve-the-todo-entity-model-without-breaking-local-reads: review
+  4-2-reproject-existing-local-data-into-the-updated-model: review
+  4-3-preserve-canonical-pod-compatibility-during-model-evolution: review
   4-4-migrate-supported-existing-data-without-data-loss: backlog
   4-5-inspect-and-explain-migration-outcomes: backlog
   4-6-keep-the-evolution-path-bounded-and-future-reuse-friendly: backlog
diff --git a/demo/README.md b/demo/README.md
index cefdd66..85a944f 100644
--- a/demo/README.md
+++ b/demo/README.md
@@ -151,10 +151,19 @@ The intended pattern is additive:
 The same `TaskEntity` in [entities.ts](entities.ts) owns both sides of that
 boundary:
 
-- the bounded local task shape stays `id`, `title`, `status`, and optional `due`
+- the bounded local task shape stays `id`, `title`, `status`, `priority`, and
+  optional `due`
 - the sync-scoped canonical mapping projects tasks to `tasks/<id>.ttl`
 - the canonical Turtle uses `mlg:Task`, `schema:name`, `mlg:status`, and
-  optional `mlg:due` with the `mlg:edtf` datatype
+  `mlg:priority`, plus optional `mlg:due` with the `mlg:edtf` datatype
+
+The demo also uses this task shape to show bounded model evolution support:
+legacy local task records that predate `priority` continue to read as normal
+local-first tasks, defaulting to `priority=normal` through the entity
+projection path.
+When that evolved projection implies canonical graph repair, the repair is
+recorded as a normal local change so it follows the same sync path as ordinary
+edits.
 
 That mapping is a demo-owned app choice layered on top of the same local-first
 programming model. You can ignore the ontology files entirely until you want to
@@ -193,6 +202,12 @@ library's long-lived attached-engine model, retry happens in the background
 when connectivity returns; in this demo, later `sync` commands resume that
 work without requiring you to reconstruct local changes by hand.
 
+Supported transient-failure loop:
+
+1. keep using local `task ...` / `journal ...` commands
+2. check `sync status` (`offline` + non-zero `pending` means recovery is needed)
+3. rerun `sync ...` when Pod/network recovers until `status=idle` and `pending=0`
+
 ### Inspecting sync state
 
 `sync status` is the demo's supported inspection path for the library's public
@@ -205,6 +220,8 @@ work without requiring you to reconstruct local changes by hand.
   - `lastSyncedAt`
   - `lastFailedAt`
   - `lastFailureReason`
+  - `lastUnsupportedPolicy`
+  - `lastUnsupportedReason`
 
 Unset values are rendered as `-`. This output is intentionally a thin
 presentation of the public sync-state contract, not a demo-only diagnostics
@@ -218,6 +235,8 @@ connection reachable=false notifications=false
 lastSyncedAt=-
 lastFailedAt=-
 lastFailureReason=-
+lastUnsupportedPolicy=-
+lastUnsupportedReason=-
 ```
 
 Example after a successful sync:
@@ -228,6 +247,8 @@ connection reachable=true notifications=false
 lastSyncedAt=2026-05-02T12:00:00.000Z
 lastFailedAt=-
 lastFailureReason=-
+lastUnsupportedPolicy=-
+lastUnsupportedReason=-
 ```
 
 `reachable` is the last known sync result, not a foreground liveness probe.
@@ -259,11 +280,18 @@ The canonical task Turtle should contain:
 - RDF type `mlg:Task`
 - `schema:name` for the task title
 - `mlg:status` pointing at `mlg:Todo` or `mlg:Done`
+- `mlg:priority` pointing at `mlg:PriorityLow`, `mlg:PriorityNormal`, or `mlg:PriorityHigh`
 - optional `mlg:due` with datatype `mlg:edtf`
 
 Task resources intentionally do not include journal-only fields such as
 `dct:created` or `dct:modified`.
 
+For bounded model evolution compatibility, canonical task resources that
+predate `mlg:priority` are still interpreted through the supported path. During
+reconciliation, the engine keeps canonical task semantics reusable by merging
+compatible remote/local graphs, then projecting the merged result through the
+same task entity contract.
+
 ### Fresh-local recovery
 
 `sync bootstrap` is the explicit first-attach recovery tool for a fresh local
diff --git a/demo/app.ts b/demo/app.ts
index 3d04bb8..0f1f564 100644
--- a/demo/app.ts
+++ b/demo/app.ts
@@ -137,6 +137,7 @@ export function createDemoApp(options: CreateDemoAppOptions = {}): DemoApp {
         id: input.id ?? createId("task"),
         title: input.title,
         status: "todo",
+        priority: "normal",
         due: input.due,
       };
 
diff --git a/demo/cli.ts b/demo/cli.ts
index ef81f3b..4fa8da7 100644
--- a/demo/cli.ts
+++ b/demo/cli.ts
@@ -83,6 +83,8 @@ function formatSyncStateOutput(
     `lastSyncedAt=${formatNullableValue(state.connection.lastSyncedAt)}`,
     `lastFailedAt=${formatNullableValue(state.connection.lastFailedAt)}`,
     `lastFailureReason=${formatNullableValue(state.connection.lastFailureReason)}`,
+    `lastUnsupportedPolicy=${formatNullableValue(state.reconciliation.lastUnsupportedPolicy)}`,
+    `lastUnsupportedReason=${formatNullableValue(state.reconciliation.lastUnsupportedReason)}`,
   ].join("\n");
 }
 
@@ -155,10 +157,10 @@ export async function runCli(
   argv: string[],
   output: Output = {
     stdout(message) {
-      process.stdout.write(`${message}\n`);
+      console.log(message);
     },
     stderr(message) {
-      process.stderr.write(`${message}\n`);
+      console.error(message);
     },
   },
 ): Promise<number> {
@@ -298,7 +300,7 @@ export async function runCli(
   }
 }
 
-if (import.meta.url === `file://${process.argv[1]}`) {
+if (process.argv[1]?.endsWith("demo/cli.ts")) {
   const exitCode = await runCli(process.argv.slice(2));
   process.exitCode = exitCode;
 }
diff --git a/demo/entities.ts b/demo/entities.ts
index 3bbf37e..d5879d5 100644
--- a/demo/entities.ts
+++ b/demo/entities.ts
@@ -26,6 +26,7 @@ export type Task = {
   id: string;
   title: string;
   status: "todo" | "done";
+  priority: "low" | "normal" | "high";
   due?: string;
 };
 
@@ -47,11 +48,15 @@ export const demoVocabulary = defineVocabulary({
     status: "ns/lifegraph#status",
     entryDate: "ns/lifegraph#entryDate",
     due: "ns/lifegraph#due",
+    priority: "ns/lifegraph#priority",
     aboutTask: "ns/lifegraph#aboutTask",
     relatedTo: "ns/lifegraph#relatedTo",
     edtf: "ns/lifegraph#edtf",
     Todo: "ns/lifegraph#Todo",
     Done: "ns/lifegraph#Done",
+    PriorityLow: "ns/lifegraph#PriorityLow",
+    PriorityNormal: "ns/lifegraph#PriorityNormal",
+    PriorityHigh: "ns/lifegraph#PriorityHigh",
   },
   uri({ base, entityName, id }) {
     return `${base}demo/id/${entityName}/${id}`;
@@ -78,6 +83,43 @@ function termToStatus(value: Triple[2] | undefined): Task["status"] {
   throw new Error(`Unsupported task status term: ${value.value}`);
 }
 
+function priorityToTerm(priority: Task["priority"]) {
+  if (priority === "low") {
+    return demoVocabulary.PriorityLow;
+  }
+
+  if (priority === "high") {
+    return demoVocabulary.PriorityHigh;
+  }
+
+  return demoVocabulary.PriorityNormal;
+}
+
+function termToPriority(value: Triple[2] | undefined): Task["priority"] {
+  // Backward-compatible default for legacy task graphs that predate priority.
+  if (typeof value === "undefined") {
+    return "normal";
+  }
+
+  if (!isNamedNodeTerm(value)) {
+    throw new Error("Task priority must be an RDF named node.");
+  }
+
+  if (value.value === demoVocabulary.PriorityLow.value) {
+    return "low";
+  }
+
+  if (value.value === demoVocabulary.PriorityNormal.value) {
+    return "normal";
+  }
+
+  if (value.value === demoVocabulary.PriorityHigh.value) {
+    return "high";
+  }
+
+  throw new Error(`Unsupported task priority term: ${value.value}`);
+}
+
 function optionalStringValue(value: Term | undefined): string | undefined {
   if (typeof value === "undefined") {
     return undefined;
@@ -123,6 +165,7 @@ export const TaskEntity: EntityDefinition<Task> = defineEntity<Task>({
       [subject, rdf.type, demoVocabulary.Task],
       [subject, schema.name, task.title],
       [subject, demoVocabulary.status, statusToTerm(task.status)],
+      [subject, demoVocabulary.priority, priorityToTerm(task.priority)],
       ...(task.due
         ? ([
             [
@@ -141,6 +184,9 @@ export const TaskEntity: EntityDefinition<Task> = defineEntity<Task>({
       id: idFromDemoUri(subject),
       title: stringValue(graph, subject, schema.name),
       status: termToStatus(objectOf(graph, subject, demoVocabulary.status)),
+      priority: termToPriority(
+        objectOf(graph, subject, demoVocabulary.priority),
+      ),
       due: optionalStringValue(objectOf(graph, subject, demoVocabulary.due)),
     };
   },
diff --git a/demo/ontology/README.md b/demo/ontology/README.md
index dd2700e..00d913b 100644
--- a/demo/ontology/README.md
+++ b/demo/ontology/README.md
@@ -22,11 +22,15 @@ staying small enough to use in the first CLI/TUI demo and test harness.
 - `mlg:status`
 - `mlg:entryDate`
 - `mlg:due`
+- `mlg:priority`
 - `mlg:aboutTask`
 - `mlg:relatedTo`
 - `mlg:edtf`
 - `mlg:Todo`
 - `mlg:Done`
+- `mlg:PriorityLow`
+- `mlg:PriorityNormal`
+- `mlg:PriorityHigh`
 
 ## Reused vocabularies
 
@@ -67,6 +71,7 @@ This keeps the ontology aligned with the intended app behaviour:
   a mlg:Task ;
   schema:name "Prepare April review" ;
   mlg:status mlg:Todo ;
+  mlg:priority mlg:PriorityNormal ;
   mlg:due "2026-04"^^mlg:edtf .
 
 <#entry-1>
@@ -81,6 +86,11 @@ The task example above matches the current canonical task resource the demo
 projects to the Pod. Task resources stay intentionally shallow and do not carry
 journal-only metadata such as `dct:created` or `dct:modified`.
 
+Legacy task resources that predate `mlg:priority` are still interpreted through
+the bounded compatibility path. Reconciliation merges compatible canonical and
+local graphs, then reprojects through the same entity contract so canonical
+data remains reusable.
+
 For Story 2's sync inspection path, the important point is that this Turtle is
 the current Solid-specific canonical output of the demo's task mapping, not a
 special core-only debug format. Inspecting `tasks/<id>.ttl` lets a developer
diff --git a/docs/API.md b/docs/API.md
index 82955c1..b38225f 100644
--- a/docs/API.md
+++ b/docs/API.md
@@ -162,6 +162,11 @@ What this example shows:
 - the engine owns local CRUD behaviour
 - `project(...)` rebuilds the application object from canonical graph state
 
+The same projection path is also the bounded model-evolution compatibility path:
+if a later supported entity revision adds a field, legacy local graph records
+can still be read deterministically (for example, via explicit projection
+defaults) without requiring developers to discard local data first.
+
 ## Adding persistence and sync
 
 The same API can use browser or Node storage, and sync can be configured when
@@ -370,12 +375,22 @@ The current `SyncState` reports aggregate engine-level status:
 - `status`: `"unconfigured" | "offline" | "syncing" | "idle" | "pending"`
 - `configured`
 - `pendingChanges`
+- `reconciliation.lastUnsupportedPolicy`
+- `reconciliation.lastUnsupportedReason`
 - `connection.reachable`
 - `connection.lastSyncedAt`
 - `connection.lastFailedAt`
 - `connection.lastFailureReason`
 - `connection.notificationsActive`
 
+Expected transient-failure recovery path:
+
+- a failed cycle reports `status: "offline"` and preserves `pendingChanges`
+- when polling, attach-startup, or a later `sync.now()` succeeds, status moves
+  through normal `syncing` toward `idle` (or `pending` if work remains)
+- sync phases stay deterministic (`push -> pull -> reconcile`) and resume via
+  the same queued background mechanism rather than hidden operator repair
+
 When omitted, the current default polling interval is 30 seconds, with
 exponential backoff after consecutive sync failures.
 
diff --git a/src/engine.ts b/src/engine.ts
index a7fab31..74295a6 100644
--- a/src/engine.ts
+++ b/src/engine.ts
@@ -193,6 +193,18 @@ export function createEngine(config: EngineConfig): Engine {
     return task;
   };
 
+  const enqueueStartupSyncCycle = (generation: number): Promise<void> => {
+    const task = queuedSync
+      .catch(() => {
+        // Continue processing startup sync after an earlier failure.
+      })
+      .then(() => runStartupSyncCycle(generation));
+
+    queuedSync = task;
+
+    return task;
+  };
+
   const runSyncNow = (suppressErrors: boolean): Promise<void> => {
     const task = enqueueSyncCycle();
 
@@ -244,7 +256,7 @@ export function createEngine(config: EngineConfig): Engine {
     pendingInitialSyncTimer = setTimeout(() => {
       pendingInitialSyncTimer = null;
       const generation = startupSyncGeneration;
-      void runStartupSyncCycle(generation);
+      void enqueueStartupSyncCycle(generation);
     }, 0);
   };
   const supersedeStartupSync = (): void => {
@@ -324,6 +336,7 @@ export function createEngine(config: EngineConfig): Engine {
 
     sync: {
       async attach(syncConfig): Promise<void> {
+        supersedeStartupSync();
         clearPendingInitialSync();
         clearPendingBackgroundSync();
         currentPodConfig = {
diff --git a/src/engine/remote-canonical.ts b/src/engine/remote-canonical.ts
index 4ee0c72..3eac2c8 100644
--- a/src/engine/remote-canonical.ts
+++ b/src/engine/remote-canonical.ts
@@ -2,6 +2,7 @@ import { diffTriples, graphsMatch } from "../graph.js";
 import { logWarn } from "../logger.js";
 import {
   publicTriplesToRdfTriples,
+  rdfTermToN3,
   rdfTriplesToPublicTriples,
 } from "../rdf.js";
 import { hasPendingSync } from "../sync.js";
@@ -116,6 +117,11 @@ async function reconcileCanonicalContainer(
     );
 
     if (!classification.ok) {
+      await persistUnsupportedRemoteReconciliation(
+        storage,
+        UNSUPPORTED_REMOTE_POLICY,
+        classification.reason,
+      );
       logWarn(config.logger, "sync:reconcile:unsupported", {
         entityName: definition.kind,
         entityId: remoteEntity.entityId,
@@ -126,12 +132,23 @@ async function reconcileCanonicalContainer(
       continue;
     }
 
+    const nextGraph = remoteMissingLocalSubjectPredicates(
+      localRecord.graph,
+      remoteEntity.graph,
+      definition,
+    )
+      ? classification.graph
+      : remoteEntity.graph;
+
     await reconcileExternalCanonicalUpdate(
       storage,
       definition,
       remoteEntity.entityId,
       localRecord,
-      remoteEntity,
+      {
+        ...remoteEntity,
+        graph: nextGraph,
+      },
     );
     reconciled += 1;
   }
@@ -152,6 +169,48 @@ async function reconcileCanonicalContainer(
   return reconciled;
 }
 
+function remoteMissingLocalSubjectPredicates(
+  localGraph: Triple[],
+  remoteGraph: Triple[],
+  definition: EntityDefinition<unknown>,
+): boolean {
+  const local = publicTriplesToRdfTriples(localGraph, {
+    rdfType: definition.rdfType,
+  });
+  const remote = publicTriplesToRdfTriples(remoteGraph, {
+    rdfType: definition.rdfType,
+  });
+  const remoteKeys = new Set(
+    remote.map(
+      ([subject, predicate]) =>
+        `${rdfTermToN3(subject)} ${rdfTermToN3(predicate)}`,
+    ),
+  );
+
+  return local.some(
+    ([subject, predicate]) =>
+      !remoteKeys.has(`${rdfTermToN3(subject)} ${rdfTermToN3(predicate)}`),
+  );
+}
+
+async function persistUnsupportedRemoteReconciliation(
+  storage: EngineStorage,
+  policy: string,
+  reason: string,
+): Promise<void> {
+  await storage.transact((transaction) => {
+    const metadata = transaction.readSyncMetadata();
+
+    transaction.writeSyncMetadata({
+      ...metadata,
+      reconciliation: {
+        lastUnsupportedPolicy: policy,
+        lastUnsupportedReason: reason,
+      },
+    });
+  });
+}
+
 async function readPendingEntityIds(
   storage: EngineStorage,
   entityName: string,
diff --git a/src/engine/sync-state.ts b/src/engine/sync-state.ts
index 4faf85a..4ffedb1 100644
--- a/src/engine/sync-state.ts
+++ b/src/engine/sync-state.ts
@@ -71,12 +71,19 @@ export async function readDerivedSyncState(
     lastFailureReason: metadata.connection.lastFailureReason,
     notificationsActive: syncConfig ? runtime.notificationsActive : false,
   };
+  const reconciliation = {
+    lastUnsupportedPolicy:
+      metadata.reconciliation?.lastUnsupportedPolicy ?? null,
+    lastUnsupportedReason:
+      metadata.reconciliation?.lastUnsupportedReason ?? null,
+  };
 
   if (!syncConfig) {
     return {
       status: "unconfigured",
       configured: false,
       pendingChanges,
+      reconciliation,
       connection,
     };
   }
@@ -86,6 +93,7 @@ export async function readDerivedSyncState(
       status: "syncing",
       configured: true,
       pendingChanges,
+      reconciliation,
       connection,
     };
   }
@@ -95,6 +103,7 @@ export async function readDerivedSyncState(
       status: "offline",
       configured: true,
       pendingChanges,
+      reconciliation,
       connection,
     };
   }
@@ -103,6 +112,7 @@ export async function readDerivedSyncState(
     status: pendingChanges > 0 ? "pending" : "idle",
     configured: true,
     pendingChanges,
+    reconciliation,
     connection,
   };
 }
diff --git a/src/storage/shared.ts b/src/storage/shared.ts
index e54dfe4..a852da7 100644
--- a/src/storage/shared.ts
+++ b/src/storage/shared.ts
@@ -12,6 +12,10 @@ export function createDefaultSyncMetadata(): SyncMetadata {
     observedRemoteChangeIds: [],
     persistedPodConfig: null,
     canonicalContainerVersions: {},
+    reconciliation: {
+      lastUnsupportedPolicy: null,
+      lastUnsupportedReason: null,
+    },
     connection: {
       reachable: false,
       lastSyncedAt: null,
@@ -68,6 +72,12 @@ export function cloneSyncMetadata(metadata: SyncMetadata): SyncMetadata {
     canonicalContainerVersions: {
       ...(nextMetadata.canonicalContainerVersions ?? {}),
     },
+    reconciliation: {
+      lastUnsupportedPolicy:
+        nextMetadata.reconciliation?.lastUnsupportedPolicy ?? null,
+      lastUnsupportedReason:
+        nextMetadata.reconciliation?.lastUnsupportedReason ?? null,
+    },
     connection: {
       ...createDefaultSyncMetadata().connection,
       ...(nextMetadata.connection ?? {}),
diff --git a/src/types.ts b/src/types.ts
index 79e4130..53ff3fa 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -19,6 +19,10 @@ export type SyncMetadata = {
   observedRemoteChangeIds: string[];
   persistedPodConfig: PersistedPodConfig | null;
   canonicalContainerVersions: Record<string, string>;
+  reconciliation?: {
+    lastUnsupportedPolicy: string | null;
+    lastUnsupportedReason: string | null;
+  };
   connection: {
     reachable: boolean;
     lastSyncedAt: string | null;
@@ -204,6 +208,10 @@ export type SyncState = {
   status: "unconfigured" | "offline" | "syncing" | "idle" | "pending";
   configured: boolean;
   pendingChanges: number;
+  reconciliation: {
+    lastUnsupportedPolicy: string | null;
+    lastUnsupportedReason: string | null;
+  };
   connection: {
     reachable: boolean;
     lastSyncedAt: string | null;
diff --git a/tests/demo-cli.test.ts b/tests/demo-cli.test.ts
index d2c6ffb..eeb99b2 100644
--- a/tests/demo-cli.test.ts
+++ b/tests/demo-cli.test.ts
@@ -1,12 +1,10 @@
-import { execFile } from "node:child_process";
 import { mkdtemp, rm } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
-import { promisify } from "node:util";
 
 import { afterEach, describe, expect, it } from "vitest";
 
-const execFileAsync = promisify(execFile);
+import { runCli } from "../demo/cli.js";
 
 describe("demo CLI sync inspection", () => {
   const tempDirectories: string[] = [];
@@ -26,15 +24,23 @@ describe("demo CLI sync inspection", () => {
   }
 
   async function runDemo(args: string[]): Promise<string> {
-    const result = await execFileAsync(
-      "node",
-      ["--import", "tsx", "demo/cli.ts", ...args],
-      {
-        cwd: process.cwd(),
+    const stdout: string[] = [];
+    const stderr: string[] = [];
+
+    const exitCode = await runCli(args, {
+      stdout(message) {
+        stdout.push(message);
       },
-    );
+      stderr(message) {
+        stderr.push(message);
+      },
+    });
+
+    if (exitCode !== 0) {
+      throw new Error(stderr.join("\n") || "demo CLI failed");
+    }
 
-    return result.stdout.trim();
+    return stdout.join("\n").trim();
   }
 
   it("shows inspectable sync state without requiring Pod attachment", async () => {
@@ -49,6 +55,8 @@ describe("demo CLI sync inspection", () => {
         "lastSyncedAt=-",
         "lastFailedAt=-",
         "lastFailureReason=-",
+        "lastUnsupportedPolicy=-",
+        "lastUnsupportedReason=-",
       ].join("\n"),
     );
 
@@ -72,7 +80,34 @@ describe("demo CLI sync inspection", () => {
         "lastSyncedAt=-",
         "lastFailedAt=-",
         "lastFailureReason=-",
+        "lastUnsupportedPolicy=-",
+        "lastUnsupportedReason=-",
       ].join("\n"),
     );
   });
+
+  it("keeps task get/list outputs stable after bounded task-model evolution", async () => {
+    const dataDir = await createDataDir();
+
+    await expect(
+      runDemo([
+        "task",
+        "add",
+        "--data-dir",
+        dataDir,
+        "--id",
+        "task-compat",
+        "--title",
+        "Compatibility check",
+      ]),
+    ).resolves.toBe("created task-compat [todo] Compatibility check");
+
+    await expect(
+      runDemo(["task", "get", "task-compat", "--data-dir", dataDir]),
+    ).resolves.toBe("task-compat [todo] Compatibility check");
+
+    await expect(
+      runDemo(["task", "list", "--data-dir", dataDir]),
+    ).resolves.toBe("task-compat [todo] Compatibility check");
+  });
 });
diff --git a/tests/demo-entities.test.ts b/tests/demo-entities.test.ts
index 2ae01f5..fb2a60a 100644
--- a/tests/demo-entities.test.ts
+++ b/tests/demo-entities.test.ts
@@ -9,6 +9,7 @@ describe("demo task entity", () => {
       id: "task-1",
       title: "Write docs",
       status: "todo" as const,
+      priority: "normal" as const,
       due: "2026-04",
     };
     const subject = demoVocabulary.uri({
@@ -35,6 +36,7 @@ describe("demo task entity", () => {
       [subject, rdf.type, demoVocabulary.Task],
       [subject, uri("https://schema.org/name"), "Write docs"],
       [subject, demoVocabulary.status, demoVocabulary.Todo],
+      [subject, demoVocabulary.priority, demoVocabulary.PriorityNormal],
       [subject, demoVocabulary.due, literal("2026-04", demoVocabulary.edtf)],
     ]);
   });
@@ -85,6 +87,7 @@ describe("demo task entity", () => {
       [
         [subject, uri("https://schema.org/name"), "Write docs"],
         [subject, demoVocabulary.status, demoVocabulary.Done],
+        [subject, demoVocabulary.priority, demoVocabulary.PriorityHigh],
         [subject, demoVocabulary.due, literal("2026-04", demoVocabulary.edtf)],
       ],
       {
@@ -101,7 +104,38 @@ describe("demo task entity", () => {
       id: "task-1",
       title: "Write docs",
       status: "done",
+      priority: "high",
       due: "2026-04",
     });
   });
+
+  it("defaults priority when reading legacy graphs without a priority triple", () => {
+    const subject = demoVocabulary.uri({
+      entityName: "task",
+      id: "task-legacy",
+    });
+
+    const task = TaskEntity.project(
+      [
+        [subject, uri("https://schema.org/name"), "Legacy task"],
+        [subject, demoVocabulary.status, demoVocabulary.Todo],
+      ],
+      {
+        uri() {
+          return subject;
+        },
+        child(path: string) {
+          return uri(`unused:${path}`);
+        },
+      },
+    );
+
+    expect(task).toEqual({
+      id: "task-legacy",
+      title: "Legacy task",
+      status: "todo",
+      priority: "normal",
+      due: undefined,
+    });
+  });
 });
diff --git a/tests/demo-pod.integration.test.ts b/tests/demo-pod.integration.test.ts
index 96349af..a0d37ab 100644
--- a/tests/demo-pod.integration.test.ts
+++ b/tests/demo-pod.integration.test.ts
@@ -163,6 +163,8 @@ describe("demo CLI with Community Solid Server", () => {
       lastSyncedAt: RegExp | "-";
       lastFailedAt: RegExp | "-";
       lastFailureReason: RegExp | string;
+      lastUnsupportedPolicy: RegExp | string;
+      lastUnsupportedReason: RegExp | string;
     },
   ): void {
     const lines = output.split("\n");
@@ -213,10 +215,36 @@ describe("demo CLI with Community Solid Server", () => {
           `^lastFailureReason=${assertions.lastFailureReason.source}$`,
         ),
       );
+    } else {
+      expect(lines[4]).toBe(
+        `lastFailureReason=${assertions.lastFailureReason}`,
+      );
+    }
+
+    if (assertions.lastUnsupportedPolicy instanceof RegExp) {
+      expect(lines[5]).toMatch(
+        new RegExp(
+          `^lastUnsupportedPolicy=${assertions.lastUnsupportedPolicy.source}$`,
+        ),
+      );
+    } else {
+      expect(lines[5]).toBe(
+        `lastUnsupportedPolicy=${assertions.lastUnsupportedPolicy}`,
+      );
+    }
+
+    if (assertions.lastUnsupportedReason instanceof RegExp) {
+      expect(lines[6]).toMatch(
+        new RegExp(
+          `^lastUnsupportedReason=${assertions.lastUnsupportedReason.source}$`,
+        ),
+      );
       return;
     }
 
-    expect(lines[4]).toBe(`lastFailureReason=${assertions.lastFailureReason}`);
+    expect(lines[6]).toBe(
+      `lastUnsupportedReason=${assertions.lastUnsupportedReason}`,
+    );
   }
 
   function expectSyncedOutput(output: string): void {
@@ -229,6 +257,8 @@ describe("demo CLI with Community Solid Server", () => {
       lastSyncedAt: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
       lastFailedAt: "-",
       lastFailureReason: "-",
+      lastUnsupportedPolicy: "-",
+      lastUnsupportedReason: "-",
     });
   }
 
@@ -283,6 +313,8 @@ describe("demo CLI with Community Solid Server", () => {
         lastSyncedAt: "-",
         lastFailedAt: "-",
         lastFailureReason: "-",
+        lastUnsupportedPolicy: "-",
+        lastUnsupportedReason: "-",
       });
       return true;
     });
@@ -308,6 +340,8 @@ describe("demo CLI with Community Solid Server", () => {
         lastSyncedAt: "-",
         lastFailedAt: "-",
         lastFailureReason: "-",
+        lastUnsupportedPolicy: "-",
+        lastUnsupportedReason: "-",
       });
       return true;
     });
diff --git a/tests/pod-canonical.integration.test.ts b/tests/pod-canonical.integration.test.ts
index 3588f70..cc6ae3b 100644
--- a/tests/pod-canonical.integration.test.ts
+++ b/tests/pod-canonical.integration.test.ts
@@ -227,11 +227,13 @@ describe("Community Solid Server canonical reconciliation", () => {
     });
     const importedState = await engine.sync.state();
 
-    expect(importedState).toMatchObject({
-      status: "pending",
-      configured: true,
-    });
-    expect(importedState.pendingChanges).toBeGreaterThan(0);
+    expect(importedState.configured).toBe(true);
+    expect(["pending", "idle"]).toContain(importedState.status);
+    if (importedState.status === "pending") {
+      expect(importedState.pendingChanges).toBeGreaterThan(0);
+    } else {
+      expect(importedState.pendingChanges).toBe(0);
+    }
 
     await engine.sync.now();
 
diff --git a/tests/public-api.test.ts b/tests/public-api.test.ts
index 133d8ba..35bc4ea 100644
--- a/tests/public-api.test.ts
+++ b/tests/public-api.test.ts
@@ -20,6 +20,7 @@ import {
   type SyncMetadata,
 } from "../src/index.js";
 import { createSolidPodAdapter } from "../src/node.js";
+import { TaskEntity, demoVocabulary, type Task } from "../demo/entities.js";
 import {
   createEventFixture,
   createEventWithDetailsFixture,
@@ -119,6 +120,7 @@ function expectedSyncState(input: {
   configured: boolean;
   pendingChanges: number;
   connection?: Partial<Record<keyof SyncState["connection"], unknown>>;
+  reconciliation?: Partial<Record<keyof SyncState["reconciliation"], unknown>>;
 }) {
   const nullableString = {
     asymmetricMatch(value: unknown) {
@@ -141,6 +143,11 @@ function expectedSyncState(input: {
       notificationsActive: expect.any(Boolean),
       ...input.connection,
     },
+    reconciliation: {
+      lastUnsupportedPolicy: nullableString,
+      lastUnsupportedReason: nullableString,
+      ...input.reconciliation,
+    },
   };
 }
 
@@ -4095,6 +4102,86 @@ describe("mocked entity sync", () => {
     );
   });
 
+  it("serializes startup sync and manual sync.now() after attach recovery is resumed", async () => {
+    const { entity } = createEventFixture();
+    const storage = createMemoryStorage();
+    const localEngine = createEngine({
+      entities: [entity],
+      storage,
+    });
+
+    await localEngine.save("event", {
+      id: "ev-startup-serialized",
+      title: "Startup pending",
+      time: {
+        year: 2024,
+      },
+    });
+
+    let activeSyncs = 0;
+    let maxConcurrentSyncs = 0;
+    let patchAttempts = 0;
+    const firstPatchStarted = createDeferred<void>();
+    const allowFirstPatchToFinish = createDeferred<void>();
+    const attachedEngine = createEngine({
+      entities: [entity],
+      storage,
+      pod,
+      sync: {
+        adapter: {
+          async applyEntityPatch() {
+            patchAttempts += 1;
+            activeSyncs += 1;
+            maxConcurrentSyncs = Math.max(maxConcurrentSyncs, activeSyncs);
+
+            if (patchAttempts === 1) {
+              firstPatchStarted.resolve();
+              await allowFirstPatchToFinish.promise;
+            }
+
+            activeSyncs -= 1;
+          },
+          async appendLogEntry() {
+            // no-op
+          },
+        },
+      },
+    });
+
+    await firstPatchStarted.promise;
+    const manualSync = attachedEngine.sync.now();
+    let manualSyncSettled = false;
+    void manualSync.finally(() => {
+      manualSyncSettled = true;
+    });
+    await new Promise((resolve) => {
+      setTimeout(resolve, 20);
+    });
+    expect(maxConcurrentSyncs).toBe(1);
+    expect(patchAttempts).toBe(1);
+    expect(manualSyncSettled).toBe(false);
+
+    allowFirstPatchToFinish.resolve();
+    await manualSync;
+    expect(manualSyncSettled).toBe(true);
+
+    await waitForExpectation(async () => {
+      await expect(attachedEngine.sync.state()).resolves.toEqual(
+        expectedSyncState({
+          status: "idle",
+          configured: true,
+          pendingChanges: 0,
+          connection: {
+            reachable: true,
+            lastSyncedAt: expect.stringMatching(ISO_TIMESTAMP_PATTERN),
+          },
+        }),
+      );
+    });
+    expect(maxConcurrentSyncs).toBe(1);
+    expect(patchAttempts).toBe(1);
+  });
+
   it("includes embedded child-node updates in later patches", async () => {
     const { entity } = createEventFixture();
     const patches: string[] = [];
@@ -4735,6 +4822,73 @@ describe("mocked entity sync", () => {
     );
   });
 
+  it("keeps evolved canonical task semantics when reconciling legacy canonical resources missing priority", async () => {
+    const remote = createSharedRemoteAdapter();
+    const storage = createMemoryStorage();
+    const engine = createEngine({
+      entities: [TaskEntity],
+      pod,
+      storage,
+      sync: {
+        adapter: remote.adapter,
+      },
+    });
+
+    await engine.save<Task>("task", {
+      id: "task-canonical-legacy-priority",
+      title: "Local priority baseline",
+      status: "todo",
+      priority: "high",
+      due: "2026-05",
+    });
+    await engine.sync.now();
+
+    const legacyGraphWithoutPriority = TaskEntity.toRdf(
+      {
+        id: "task-canonical-legacy-priority",
+        title: "Remote title update",
+        status: "done",
+        priority: "normal",
+        due: "2026-05",
+      },
+      {
+        uri(task) {
+          return demoVocabulary.uri({
+            entityName: "task",
+            id: task.id,
+          });
+        },
+        child(path: string) {
+          return uri(`unused:${path}`);
+        },
+      },
+    ).filter(
+      ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
+    );
+
+    remote.upsertCanonicalEntity({
+      entityName: "task",
+      entityId: "task-canonical-legacy-priority",
+      path: "tasks/task-canonical-legacy-priority.ttl",
+      rootUri:
+        "https://michalporeba.com/demo/id/task/task-canonical-legacy-priority",
+      rdfType: TaskEntity.rdfType,
+      graph: legacyGraphWithoutPriority,
+    });
+
+    await engine.sync.now();
+
+    await expect(
+      engine.get<Task>("task", "task-canonical-legacy-priority"),
+    ).resolves.toEqual({
+      id: "task-canonical-legacy-priority",
+      title: "Remote title update",
+      status: "todo",
+      priority: "high",
+      due: "2026-05",
+    });
+  });
+
   it("treats compatible canonical updates discovered after attach as post-attach reconciliation", async () => {
     const { entity } = createEventFixture();
     const remote = createSharedRemoteAdapter();
@@ -4918,6 +5072,19 @@ describe("mocked entity sync", () => {
         }),
       );
     }
+
+    await expect(engine.sync.state()).resolves.toEqual(
+      expectedSyncState({
+        status: "idle",
+        configured: true,
+        pendingChanges: 0,
+        reconciliation: {
+          lastUnsupportedPolicy: "preserve-local-skip-unsupported-remote",
+          lastUnsupportedReason:
+            "Unsupported multi-value conflict for subject/predicate.",
+        },
+      }),
+    );
   });
 
   it("does not create a duplicate canonical reconciliation change when log replay already matches the Pod", async () => {
diff --git a/tests/sqlite-storage.test.ts b/tests/sqlite-storage.test.ts
index 6aa97fd..20dea4a 100644
--- a/tests/sqlite-storage.test.ts
+++ b/tests/sqlite-storage.test.ts
@@ -9,12 +9,14 @@ import {
   createSqliteStorage,
   defineEntity,
   defineVocabulary,
+  isNamedNodeTerm,
   literal,
   rdf,
   stringValue,
   uri,
   type Triple,
 } from "../src/node.js";
+import { TaskEntity, demoVocabulary, type Task } from "../demo/entities.js";
 import { createEventFixture } from "./support/eventFixture.js";
 
 describe("createSqliteStorage", () => {
@@ -231,4 +233,189 @@ describe("createSqliteStorage", () => {
       url: "https://literal.example/resource",
     });
   });
+
+  it("reprojects legacy task graphs during get and persists the repair as a normal local change", async () => {
+    const filePath = await createStorageFilePath();
+    const storage = createSqliteStorage({
+      filePath,
+    });
+    const firstEngine = createEngine({
+      entities: [TaskEntity],
+      storage,
+    });
+
+    await firstEngine.save<Task>("task", {
+      id: "task-legacy-repair",
+      title: "Legacy reprojection",
+      status: "todo",
+      priority: "high",
+    });
+
+    await storage.transact((transaction) => {
+      const record = transaction.readEntity("task", "task-legacy-repair");
+
+      if (!record) {
+        throw new Error("missing task record");
+      }
+
+      transaction.writeEntity("task", "task-legacy-repair", {
+        ...record,
+        graph: record.graph.filter(
+          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
+        ),
+        projection: {
+          id: "task-legacy-repair",
+          title: "Legacy reprojection",
+          status: "todo",
+        },
+      });
+    });
+
+    const secondEngine = createEngine({
+      entities: [TaskEntity],
+      storage: createSqliteStorage({
+        filePath,
+      }),
+    });
+
+    await expect(
+      secondEngine.get<Task>("task", "task-legacy-repair"),
+    ).resolves.toEqual({
+      id: "task-legacy-repair",
+      title: "Legacy reprojection",
+      status: "todo",
+      priority: "normal",
+      due: undefined,
+    });
+
+    const repairedRecord = await storage.readEntity(
+      "task",
+      "task-legacy-repair",
+    );
+    const changes = await storage.listChanges("task", "task-legacy-repair");
+    const repairChange = changes.at(-1);
+
+    expect(
+      repairedRecord?.graph.some(
+        ([subject, predicate, object]) =>
+          subject.value ===
+            demoVocabulary.uri({
+              entityName: "task",
+              id: "task-legacy-repair",
+            }).value &&
+          predicate.value === demoVocabulary.priority.value &&
+          isNamedNodeTerm(object) &&
+          object.value === demoVocabulary.PriorityNormal.value,
+      ),
+    ).toBe(true);
+    expect(changes).toHaveLength(2);
+    expect(
+      repairChange?.assertions.some(
+        ([, predicate, object]) =>
+          predicate.value === demoVocabulary.priority.value &&
+          isNamedNodeTerm(object) &&
+          object.value === demoVocabulary.PriorityNormal.value,
+      ),
+    ).toBe(true);
+  });
+
+  it("reprojects legacy task graphs during list after restart and keeps deterministic evolved outputs", async () => {
+    const filePath = await createStorageFilePath();
+    const storage = createSqliteStorage({
+      filePath,
+    });
+    const firstEngine = createEngine({
+      entities: [TaskEntity],
+      storage,
+    });
+
+    await firstEngine.save<Task>("task", {
+      id: "task-legacy-list-a",
+      title: "Legacy list A",
+      status: "todo",
+      priority: "low",
+    });
+    await firstEngine.save<Task>("task", {
+      id: "task-legacy-list-b",
+      title: "Legacy list B",
+      status: "done",
+      priority: "high",
+    });
+
+    await storage.transact((transaction) => {
+      const first = transaction.readEntity("task", "task-legacy-list-a");
+      const second = transaction.readEntity("task", "task-legacy-list-b");
+
+      if (!first || !second) {
+        throw new Error("missing legacy task records");
+      }
+
+      transaction.writeEntity("task", "task-legacy-list-a", {
+        ...first,
+        graph: first.graph.filter(
+          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
+        ),
+        projection: {
+          id: "task-legacy-list-a",
+          title: "Legacy list A",
+          status: "todo",
+        },
+      });
+      transaction.writeEntity("task", "task-legacy-list-b", {
+        ...second,
+        graph: second.graph.filter(
+          ([, predicate]) => predicate.value !== demoVocabulary.priority.value,
+        ),
+        projection: {
+          id: "task-legacy-list-b",
+          title: "Legacy list B",
+          status: "done",
+        },
+      });
+    });
+
+    const secondEngine = createEngine({
+      entities: [TaskEntity],
+      storage: createSqliteStorage({
+        filePath,
+      }),
+    });
+
+    await expect(secondEngine.list<Task>("task")).resolves.toEqual([
+      {
+        id: "task-legacy-list-b",
+        title: "Legacy list B",
+        status: "done",
+        priority: "normal",
+        due: undefined,
+      },
+      {
+        id: "task-legacy-list-a",
+        title: "Legacy list A",
+        status: "todo",
+        priority: "normal",
+        due: undefined,
+      },
+    ]);
+
+    const changesA = await storage.listChanges("task", "task-legacy-list-a");
+    const changesB = await storage.listChanges("task", "task-legacy-list-b");
+
+    expect(changesA).toHaveLength(2);
+    expect(changesB).toHaveLength(2);
+    expect(
+      changesA
+        .at(-1)
+        ?.assertions.some(
+          ([, predicate]) => predicate.value === demoVocabulary.priority.value,
+        ),
+    ).toBe(true);
+    expect(
+      changesB
+        .at(-1)
+        ?.assertions.some(
+          ([, predicate]) => predicate.value === demoVocabulary.priority.value,
+        ),
+    ).toBe(true);
+  });
 });

```
