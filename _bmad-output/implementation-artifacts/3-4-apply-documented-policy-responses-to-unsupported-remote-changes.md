# Story 3.4: Apply Documented Policy Responses to Unsupported Remote Changes

Status: done

## Story

As a developer troubleshooting unexpected remote edits,
I want `lofipod` to respond to unsupported cases in a predictable documented way,
so that failure behavior is trustworthy even when the system cannot automatically reconcile safely.

## Acceptance Criteria

1. Given a remote change has already been classified as unsupported or unsafe for automatic reconciliation, when the client applies the documented policy response, then it follows a consistent bounded behavior rather than leaving the outcome undefined, and the policy is understandable enough that a developer can predict what the system will do next.
2. Given the unsupported remote change cannot be safely merged into local state, when policy handling occurs, then the system preserves trust by avoiding silent corruption or destructive overwrite of local data, and the existing supported local state remains usable through the normal local-first surface unless the documented policy explicitly says otherwise.
3. Given the system encounters an unsupported remote condition more than once, when the same class of condition is re-evaluated, then the documented policy response remains consistent across occurrences, and the behavior does not depend on hidden operator intervention or ad hoc decisions.
4. Given a developer is reviewing how `lofipod` behaves outside its supported automatic boundaries, when they inspect the demo scenario and documentation for this story, then they can understand the difference between supported reconciliation, unsupported classification, and policy response, and the repository shows that unsupported cases are handled explicitly rather than silently ignored.
5. Given the project aims for a CRDT-light trust model rather than arbitrary merge behavior, when this story is complete, then developers can see that unsupported remote edits trigger a defined protective response, and that response creates a stable basis for diagnostics and later recovery workflows.

## Tasks / Subtasks

- [x] Define and implement a single bounded policy response for unsupported canonical reconciliation results (AC: 1, 2, 3)
- [x] Reuse existing unsupported classification from Story 3.3 and avoid creating a second classifier path (AC: 1, 3)
- [x] Persist policy-response signal in an inspectable surface (sync state and/or explicit warning metadata) without exposing secrets (AC: 1, 4)
- [x] Keep local supported state usable and unchanged for unsupported remote edits; do not auto-overwrite local entities (AC: 2)
- [x] Add behavior-first tests for repeated unsupported detections proving deterministic response across multiple sync cycles (AC: 3)
- [x] Update demo/docs touchpoints so supported reconciliation vs unsupported classification vs policy response are visible and understandable (AC: 4, 5)
- [x] Keep policy handling isolated from broader migration/recovery work planned for Stories 3.5 and 3.6 (AC: 5)

## Dev Notes

### Epic Context

- Epic 3 focuses on trust, recovery, and explainability under failure.
- Story 3.1 implemented compatible remote replay.
- Story 3.2 implemented supported canonical reconciliation after attach.
- Story 3.3 implemented unsupported/unsafe classification for remote edits.
- Story 3.4 now adds the documented policy response for those unsupported cases; Story 3.5 will focus on broader diagnostics UX and Story 3.6 on recovery execution.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.1-3.6)]

### Current State: Relevant Files to Read Before Changes

- `src/engine/remote-canonical.ts`
  - Current state: calls `mergeSupportedGraphs(...)`; logs `sync:reconcile:unsupported` when unsupported and skips mutation.
  - Story 3.4 change: apply a documented policy response when unsupported classification occurs (for example: explicit policy event/state + deterministic skip behavior), without changing supported merge flow.
  - Must preserve: pending-local guard, deterministic reconcile ordering, supported merge import path.

- `src/engine/supported-merge.ts`
  - Current state: centralized bounded-merge classifier and merge utility.
  - Story 3.4 change: no new classifier. Reuse returned `reason` for policy handling and observability.
  - Must preserve: deterministic merge/conflict semantics used by bootstrap and reconcile flows.

- `src/engine/remote.ts`
  - Current state: serialized cycle `push -> pull -> reconcile` with timing logs.
  - Story 3.4 change: keep cycle order and non-blocking behavior; policy response should fit existing reconcile stage.
  - Must preserve: no parallel sync path, no sync lifecycle contract change.

- `src/types.ts` (and any public sync types/export files)
  - Current state: public types include bootstrap unsupported/collision results and sync state.
  - Story 3.4 change: if adding policy response visibility, keep additions minimal and stable at public boundary.
  - Must preserve: API clarity and environment-neutral core surface.

- `tests/public-api.test.ts`
  - Current state: has coverage for unsupported bootstrap/reconcile classification.
  - Story 3.4 change: add policy-response behavior checks and repeated-occurrence determinism checks.
  - Must preserve: behavior-first assertions through public API.

- `tests/pod-canonical.integration.test.ts` and/or `tests/pod-auto-sync.integration.test.ts`
  - Current state: focused Pod integration around canonical reconciliation and auto-sync behavior.
  - Story 3.4 change: add at most one focused integration assertion for inspectable policy response if runtime cost stays bounded.
  - Must preserve: efficient CI runtime and deterministic assertions.

### Policy Response Guardrails

- Use one explicit, documented protective behavior for unsupported remote canonical edits in this phase.
- Avoid silent fallback behavior; unsupported condition must remain inspectable.
- Do not delete or overwrite healthy local state due to unsupported remote edits.
- Keep behavior deterministic across repeated sync cycles for same unsupported condition.
- Keep secrets out of logs/diagnostics (no token/credential leakage).
- Do not implement full recovery orchestration here; defer workflow-level recovery to Story 3.6.

### Architecture & API Compliance

- Keep root package framework-agnostic and environment-neutral.
- Do not introduce React or browser/Node runtime assumptions into core sync modules.
- Keep strict TypeScript discipline; avoid `any`, broad casts, and suppression comments.
- Keep public API changes minimal and documented if any externally-visible type/behavior changes.
- If architecture intent changes materially, update `docs/ADR.md`; if public API changes, update `docs/API.md`.

[Source: `README.md`, `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, `docs/WIP.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]

### Technical Requirements

- Preserve local-first behavior: local CRUD remains available and non-blocking while unsupported remote edits are handled.
- Preserve sync serialization and idempotency in repeated `sync.now()` calls.
- Keep unsupported handling consistent between canonical polling cycles and repeated occurrences.
- Ensure policy response output is stable enough for Story 3.5 diagnostics expansion.

### Testing Requirements

Required pre-handoff checks:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during development:

- `npx vitest tests/public-api.test.ts -t "unsupported|policy|reconcile"`
- `npx vitest tests/pod-canonical.integration.test.ts`
- `npx vitest tests/pod-auto-sync.integration.test.ts`

### Previous Story Intelligence (3.3)

- 3.3 intentionally stopped at detection/classification and left policy actions for 3.4.
- Shared classifier reuse (`src/engine/supported-merge.ts`) was established to prevent duplicate logic.
- Canonical reconcile currently warns and skips unsupported cases; 3.4 should layer explicit policy response semantics on top of that existing safe default.
- Recent delivery pattern is incremental, behavior-first, and test-gated; keep changes narrow and verifiable.

[Source: `_bmad-output/implementation-artifacts/3-3-detect-and-classify-unsupported-or-unsafe-remote-edits.md`]

### Git Intelligence Summary

Recent commit titles and scope:

- `13ab4ac` unsafe remote edits (`remote-canonical`, `remote-bootstrap`, `supported-merge`, public API tests)
- `6c5ec98` reconcile supported canonical changes (public + integration sync tests)
- `6cf45e2` replay compatible remote changes (public + integration sync tests)
- `bd534a6` demonstrate multi-device setup
- `01bc19f` inspectable sync state

Actionable takeaway: continue the established pattern of small sync-core deltas with strong public behavior tests and minimal integration additions.

### Latest Tech Information (May 3, 2026)

- Node.js release policy still recommends production workloads on Active or Maintenance LTS lines; current project baseline (`>=24`) remains aligned.
- Vitest 4 migration guidance requires Node.js `>=20` and Vite `>=6`; current stack is compatible.
- Inrupt auth docs continue to center `@inrupt/solid-client-authn-node` Session-based server-side flows, consistent with adapter-boundary architecture.

Sources:
- https://nodejs.org/en/about/releases/
- https://main.vitest.dev/guide/migration
- https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-shared/
- https://docs.inrupt.com/guides/authentication-in-solid/authentication-server-side

### Project Structure Notes

- Keep policy behavior implementation in existing sync engine modules (`src/engine/*`) rather than creating new top-level subsystems.
- Keep tests in existing public/integration suites, aligned with current conventions.
- Prefer extending existing logger/sync-state mechanisms over introducing parallel diagnostics channels.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `src/engine/remote.ts`
- `src/engine/remote-canonical.ts`
- `src/engine/supported-merge.ts`
- `src/types.ts`
- `tests/public-api.test.ts`
- `tests/pod-canonical.integration.test.ts`
- `tests/pod-auto-sync.integration.test.ts`

## Story Completion Status

- Story context created with comprehensive artifact analysis and implementation guardrails.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved `bmad-create-story` workflow customization and loaded persistent context.
- Loaded required project docs and artifact sources.
- Parsed full sprint status and selected first backlog story `3-4-apply-documented-policy-responses-to-unsupported-remote-changes`.
- Analyzed Epic 3 story context, previous story (3.3), relevant sync engine files, and recent git history.
- Performed targeted latest-tech verification (Node/Vitest/Inrupt) against primary docs.
- Executed `bmad-dev-story` workflow activation and loaded full sprint/story context for Story 3.4.
- Updated sprint tracking to `in-progress` before implementation.
- Added failing public API test first for deterministic unsupported policy behavior:
  - `npx vitest tests/public-api.test.ts -t "deterministic policy response for unsupported post-attach canonical edits"` (failed as expected).
- Implemented explicit bounded policy metadata in unsupported reconcile warnings in `src/engine/remote-canonical.ts`.
- Extended public API behavior test to verify repeated unsupported detections produce consistent policy metadata and no local-state mutation.
- Updated docs touchpoints for policy visibility:
  - `docs/API.md` logging section
  - `demo/README.md` sync inspection guidance
- Ran focused validation:
  - `npx vitest tests/public-api.test.ts -t "unsupported|policy|reconcile"`
- Ran required project gates:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`

### Completion Notes List

- Created Story 3.4 implementation guide with acceptance criteria mapping and bounded policy-response scope.
- Captured exact code areas, preservation constraints, and anti-regression guardrails.
- Added deterministic policy behavior requirements for repeated unsupported conditions.
- Documented required and focused test commands aligned with project CI expectations.
- Preserved separation of concerns with later diagnostics/recovery stories (3.5, 3.6).
- Added explicit bounded policy marker on unsupported canonical reconcile events:
  - `policy: "preserve-local-skip-unsupported-remote"`.
- Preserved Story 3.3 classifier reuse (`mergeSupportedGraphs`) without introducing a second classifier path.
- Verified unsupported remote canonical edits do not overwrite local supported state and do not append additional local changes.
- Added behavior-first regression proving deterministic repeated policy response across sync cycles.
- Documented the policy response in API and demo docs to make supported-vs-unsupported handling inspectable and predictable.
- Completed required verification and integration gates with passing results.

### File List

- _bmad-output/implementation-artifacts/3-4-apply-documented-policy-responses-to-unsupported-remote-changes.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/engine/remote-canonical.ts
- tests/public-api.test.ts
- docs/API.md
- demo/README.md

## Change Log

- 2026-05-03: Implemented Story 3.4 bounded policy response for unsupported canonical remote edits, added deterministic repeated-behavior tests, and updated API/demo docs for policy visibility.

### Review Findings

- [x] [Review][Decision] Keep or revert broadened merge grouping semantics for non-IRI/blank-node subjects — resolved to revert to named-node-only grouping to preserve the shallow bounded model and avoid introducing anonymous-node complexity.
- [x] [Review][Patch] Revert broadened merge grouping to named-node-only subjects [src/engine/supported-merge.ts:96]
- [x] [Review][Patch] Preserve unsupported reconciliation metadata across no-change cycles [src/engine/remote-canonical.ts:78]
