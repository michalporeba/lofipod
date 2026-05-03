# Story 3.3: Detect and Classify Unsupported or Unsafe Remote Edits

Status: review

## Story

As a developer who depends on trustworthy sync behavior,
I want `lofipod` to detect and classify unsupported or unsafe remote edits,
so that the system does not silently merge data outside the bounded model.

## Acceptance Criteria

1. Given sync is attached and canonical or replayed remote data includes edits outside the supported bounded model, when those edits are evaluated, then the system classifies them as unsupported or unsafe for automatic reconciliation, and does not silently treat them as supported merges.
2. Given a developer or user manually edits canonical Pod data outside documented `lofipod` conventions, when the client later processes those changes, then it can distinguish this from normal compatible replay, and produce an inspectable classification result.
3. Given the repository is demonstrating CRDT-light trust boundaries, when this story is complete, then developers can see a concrete repeatable example of supported-vs-unsupported classification behavior that is explicit and understandable.

## Tasks / Subtasks

- [x] Preserve and extend unsupported/unsafe classification as a first-class sync concern. (AC: 1, 2)
- [x] Reuse existing bounded-merge classification logic from bootstrap paths where possible; do not duplicate conflict classifiers. (AC: 1)
- [x] Ensure classification is explicit and inspectable through existing public surfaces used in tests (bootstrap result and/or sync-observable state/log metadata used by current public tests). (AC: 2, 3)
- [x] Add or update behavior-first tests for unsupported/unsafe remote edits in canonical and/or replay flows. (AC: 1, 2, 3)
- [x] Keep story scope to detection/classification only; do not implement policy response actions from Story 3.4 in this story. (AC: 1, 3)

## Dev Notes

### Epic Context

- Epic 3 focuses on trust, recovery, and explainability under failure.
- Story 3.1 established compatible remote replay.
- Story 3.2 established post-attach compatible canonical reconciliation.
- Story 3.3 now defines the unsupported/unsafe boundary classification.
- Story 3.4 will apply policy responses and must stay separate.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.1-3.4)]

### Current State: Relevant Files to Read Before Changes

- `src/engine/remote-canonical.ts`
  - Current behavior: imports compatible external canonical creates/updates/deletes, skips pending-local entities, appends local inspectable change records with `entityProjected: true`, `logProjected: false`.
  - Preserve: existing supported reconciliation behavior and pending-local protection.
  - Change target: add/route unsupported or unsafe classification for post-attach remote edits without changing successful supported paths.

- `src/engine/remote.ts`
  - Current behavior: sync cycle order is `push -> pull -> reconcile`.
  - Preserve: serialized cycle order and background semantics.
  - Change target: avoid adding parallel or alternate sync pipelines.

- `src/engine/remote-bootstrap.ts`
  - Current behavior: has bounded merge classifier and returns `unsupported` and `collisions` when mixed-state differences exceed supported model.
  - Preserve: reason semantics and deterministic behavior.
  - Change target: reuse existing classification style and reasoning rather than inventing a second incompatible classifier.

- `src/types.ts`
  - Current behavior: exposes `BootstrapUnsupported`, `BootstrapCollision`, and `BootstrapResult`.
  - Change target: if new public classification shape is required, keep it minimal, explicit, and aligned with existing API style.

- `tests/public-api.test.ts`
  - Current behavior: already covers unsupported mixed-state differences during bootstrap and compatible canonical reconciliation cases.
  - Change target: add post-attach and/or replay-path unsupported classification proofs where missing.

- `tests/pod-canonical.integration.test.ts`
  - Current behavior: real Pod coverage for external canonical create/update reconciliation.
  - Change target: add at most one focused unsupported external canonical scenario if feasible without overloading integration runtime.

### Implementation Guardrails

- Keep root package framework-agnostic; no React assumptions in core.
- Keep root entrypoint environment-neutral; no browser/node leakage across public boundaries.
- Do not weaken strict TypeScript typing (`any`, suppressions, broad casts).
- Keep classification deterministic and inspectable; never silently coerce unsupported edits into supported merges.
- Preserve existing supported-path behavior and tests while adding unsupported-path coverage.
- Keep change scope narrow to detection/classification; defer policy action mechanics to Story 3.4.

[Source: `AGENTS.md`, `docs/ADR.md`, `docs/API.md`, `_bmad-output/project-context.md`, `docs/architecture.md`]

### Testing Requirements

Required checks before marking implementation complete:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during development:

- `npx vitest tests/public-api.test.ts -t "unsupported|unsafe|canonical"`
- `npx vitest tests/pod-canonical.integration.test.ts`

### Previous Story Intelligence (3.2)

- Recent pattern is behavior-first and test-first for sync trust claims.
- 3.2 kept orchestration stable and expanded tests rather than rewriting architecture.
- For 3.3, follow the same pattern: prove unsupported/unsafe detection with tight tests, then minimally extend engine behavior.

[Source: `_bmad-output/implementation-artifacts/3-2-reconcile-supported-canonical-remote-changes-after-attach.md`]

### Git Intelligence Summary

Recent commits:

- `6c5ec98` reconcile supported canonical changes
- `6cf45e2` replay compatible remote changes
- `bd534a6` demonstrate multi-device setup
- `01bc19f` inspectable sync state
- `fe8eb3c` improving tests

Actionable takeaway: continue incremental trust-boundary delivery with narrow engine deltas and strong behavior-focused tests.

### Latest Tech Information (May 3, 2026)

- Node.js official releases guidance continues to require production workloads to target Active or Maintenance LTS lines.
- Vitest 4 migration guidance requires Node.js `>=20` and Vite `>=6`; project baseline Node `>=24` remains compatible.
- Inrupt Node authentication docs continue to use `@inrupt/solid-client-authn-node` Session-based flows, supporting current adapter-boundary architecture.

Sources:
- https://nodejs.org/en/about/previous-releases
- https://main.vitest.dev/guide/migration
- https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-shared/
- https://docs.inrupt.com/guides/authentication-in-solid/authentication-server-side

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `_bmad-output/project-context.md`
- `src/engine/remote.ts`
- `src/engine/remote-canonical.ts`
- `src/engine/remote-bootstrap.ts`
- `src/types.ts`
- `tests/public-api.test.ts`
- `tests/pod-canonical.integration.test.ts`

## Story Completion Status

- Story context created with full artifact analysis and implementation guardrails.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved customization workflow for `bmad-create-story`.
- Loaded project context plus required core docs (`README.md`, `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, `docs/WIP.md`).
- Parsed full `_bmad-output/implementation-artifacts/sprint-status.yaml` and selected first backlog story `3-3-detect-and-classify-unsupported-or-unsafe-remote-edits`.
- Loaded planning artifacts (`epics.md`, `prd.md`) and architecture fallback (`docs/architecture.md`).
- Loaded previous story (`3-2-*`) and recent git history for implementation patterns.
- Performed targeted web verification for Node/Vitest/Inrupt current guidance.
- Executed `bmad-dev-story` workflow: moved story status in sprint tracking to `in-progress` before implementation.
- Added failing test first: `npx vitest tests/public-api.test.ts -t "classifies unsupported post-attach canonical edits"`.
- Implemented shared classifier reuse in `src/engine/supported-merge.ts` and wired it into both bootstrap and post-attach canonical reconciliation.
- Re-ran targeted tests and regression slices:
  - `npx vitest tests/public-api.test.ts -t "classifies unsupported post-attach canonical edits"`
  - `npx vitest tests/public-api.test.ts -t "unsupported|canonical|bootstrap"`
- Ran required project gates:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Observed one transient `tests/demo-cli.test.ts` failure during a verify run; reproduced the test in isolation, then reran verify successfully.

### Completion Notes List

- Created Story 3.3 implementation guide with AC mapping, code guardrails, and explicit scope boundaries.
- Captured existing classification mechanisms and reuse expectations to prevent duplicate logic.
- Added concrete test targets and workflow gate expectations.
- Kept 3.3 scope restricted to detection/classification and deferred policy handling to 3.4.
- Implemented unsupported/unsafe post-attach canonical classification that skips unsafe merges and preserves local state.
- Reused bounded merge logic across bootstrap and canonical reconciliation via a shared engine utility to avoid duplicate conflict classifiers.
- Added explicit inspectable classification signal through structured warn logging (`sync:reconcile:unsupported`) with entity/path/reason metadata.
- Added behavior-first test coverage proving unsupported canonical edits are classified, not merged, and do not append extra local/remote changes.
- Completed all required verification gates with green results (`verify`, `build`, `test:demo`, `test:pod`).

### File List

- _bmad-output/implementation-artifacts/3-3-detect-and-classify-unsupported-or-unsafe-remote-edits.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/engine/supported-merge.ts
- src/engine/remote-bootstrap.ts
- src/engine/remote-canonical.ts
- tests/public-api.test.ts

## Change Log

- 2026-05-03: Implemented Story 3.3 unsupported/unsafe remote edit classification for post-attach canonical reconciliation; reused bounded merge classifier; added focused public API coverage; completed verify/build/demo/pod gates.
