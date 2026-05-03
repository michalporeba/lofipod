# Story 3.2: Reconcile Supported Canonical Remote Changes After Attach

Status: done

## Story

As a developer sharing canonical data across app instances,
I want the app to detect and import supported remote canonical changes after sync is already attached,
so that my local state stays aligned with compatible remote edits.

## Acceptance Criteria

1. Given sync is already attached and canonical remote todo data changes after initial bootstrap is complete, when the local client detects those remote canonical changes through the supported sync path, then it evaluates them as ongoing post-attach changes rather than as first-attach import work, and the resulting behavior remains consistent with the documented bounded model.
2. Given a remote canonical change stays within the supported entity shape and invariants, when the client reconciles that change into local state, then the local read model is updated to reflect the compatible remote change, and the resulting local entity remains usable through the same application-facing workflow as locally produced data.
3. Given a supported canonical remote change overlaps with existing local knowledge of the same entity, when reconciliation occurs, then the system applies the documented CRDT-light policy for supported cases, and the outcome remains deterministic and inspectable rather than ad hoc.
4. Given the developer is trying to understand the boundary between supported and unsupported external changes, when they review this story’s demo behavior and documentation, then it is clear that this story covers compatible canonical edits after attach, and it remains distinct from manual or structurally unsafe remote edits that will be handled in later stories.
5. Given the repository is being used to validate trust in shared canonical data, when this story is complete, then developers can see a repeatable example of post-attach compatible canonical reconciliation, and that example serves as the supported baseline before unsafe-change detection and policy stories.

## Tasks / Subtasks

- [x] Confirm post-attach canonical reconciliation remains on the existing sync path (`push -> pull -> reconcile`) and does not introduce a second pipeline. (AC: 1, 4)
  - [x] Keep orchestration in `src/engine/remote.ts` unchanged unless a failing test proves a real gap.
  - [x] Keep canonical reconciliation centralized in `src/engine/remote-canonical.ts`.
- [x] Prove compatible canonical updates are reconciled into local state and visible through public reads. (AC: 1, 2, 3, 5)
  - [x] Maintain/extend `tests/public-api.test.ts` coverage for the post-attach canonical scenario.
  - [x] Assert local entity projection is updated and reconciliation appends local changes as inspectable state (`entityProjected: true`, `logProjected: false`).
  - [x] Assert duplicate reconciliation changes are not appended when replayed/log state already matches canonical state.
- [x] Keep reconciliation bounded and deterministic for supported shape/invariant changes only. (AC: 2, 3, 4)
  - [x] Preserve pending-local-change protections in `src/engine/remote-canonical.ts`.
  - [x] Do not pull unsupported/unsafe foreign-edit classification/policy work from Stories 3.3-3.4 into this story.
- [x] Provide one focused real-Pod proof for post-attach compatible canonical reconciliation. (AC: 1, 2, 4, 5)
  - [x] Keep/extend `tests/pod-canonical.integration.test.ts` scenario(s) proving external canonical update detection and local reconciliation after attach.
  - [x] Keep assertions behavior-first (`get(...)`, `list(...)`, `sync.state()`), not deep internals.
- [x] Keep docs boundary clear only if needed. (AC: 4)
  - [x] If ambiguity remains, add concise wording in docs (prefer existing `demo/README.md`/architecture docs) distinguishing post-attach canonical reconciliation from bootstrap import.

### Review Findings

- [x] [Review][Decision] Review scope mismatch: uncommitted metadata-only diff vs story implementation validation — Resolved by reviewing the committed Story 3.2 implementation range `6cf45e2..2e98d99` (includes `tests/public-api.test.ts` and `tests/pod-canonical.integration.test.ts` changes). No additional patch findings remained after committed-diff review.

## Dev Notes

### Epic Context

- Epic 3 focus is trust, recovery, and explainability under failure.
- Story 3.1 established supported remote log replay from another `lofipod` client.
- Story 3.2 establishes the supported canonical-edit baseline after attach.
- Stories 3.3+ handle unsupported/unsafe edits and policy responses.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.1-3.4)]

### Current Code State and Required Guardrails

- `src/engine/remote.ts`
  - Current: `syncNow` executes push, replay remote log, then canonical reconciliation.
  - Preserve: serialized sequence and background sync semantics.
  - Change scope: do not add alternate reconciliation flow.

- `src/engine/remote-canonical.ts`
  - Current: checks canonical container versions, reconciles compatible external create/update/delete, skips entities with pending local changes, appends local inspectable changes.
  - Preserve: pending-local-change protection, deterministic reconciliation, `entityProjected: true` + `logProjected: false` semantics.
  - Change scope: only behavior fixes discovered by failing tests.

- `src/engine/remote-pull.ts` and `src/engine/remote-merge.ts`
  - Current: replay and deterministic merge/fork reconciliation for supported cases.
  - Preserve: replay idempotency, deterministic conflict ordering.
  - Change scope: none expected for this story unless tests show coupling bugs.

[Source: `src/engine/remote.ts`, `src/engine/remote-canonical.ts`, `src/engine/remote-pull.ts`, `src/engine/remote-merge.ts`]

### Files Most Likely to Change

- `tests/public-api.test.ts`
- `tests/pod-canonical.integration.test.ts`
- Optional (only if needed): `demo/README.md`, `docs/architecture.md`
- Core engine files only if tests reveal a concrete bug:
  - `src/engine/remote-canonical.ts`
  - (rare) `src/engine/remote.ts`

### Testing Requirements

Run workflow-equivalent checks before handoff:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

[Source: `AGENTS.md`, `_bmad-output/project-context.md`, `docs/TESTING.md`]

### Project Structure Notes

- Keep root package framework-agnostic and environment-neutral.
- Keep browser/node specifics in dedicated entrypoints and adapters.
- Do not introduce React assumptions into core engine/sync/RDF layers.

[Source: `AGENTS.md`, `docs/ADR.md`, `docs/architecture.md`]

### Previous Story Intelligence (3.1)

- 3.1 used behavior-first proofs via public API and real Pod tests.
- 3.1 reinforced that new trust claims should prefer test expansion over architectural rewrites.
- Keep that delivery pattern for 3.2.

[Source: `_bmad-output/implementation-artifacts/3-1-replay-compatible-remote-changes-from-another-lofipod-client.md`]

### Git Intelligence (Recent Patterns)

Recent commits show a test-first pattern for sync trust behavior and canonical reconciliation:

- `2e98d99` reconcile-supported-canonical-changes
- `6cf45e2` replay compatible remote changes
- `bd534a6` demonstrate multi-device setup
- `01bc19f` inspectable sync state
- `fe8eb3c` improving tests

Actionable implication: continue with narrow, behavior-focused proof increments and avoid broad API/architecture churn.

### Latest Technical Information

- Node.js release policy and supported status confirm the repo baseline `>=24` is aligned with active LTS usage expectations.
- Vitest 4 migration guidance requires Node `>=20` and Vite `>=6`, which is compatible with this repo baseline.
- Inrupt Node authentication guidance still uses `@inrupt/solid-client-authn-node` with Session-based flows, reinforcing adapter-layer isolation for Solid-specific concerns.

Sources:
- https://nodejs.org/en/about/previous-releases
- https://main.vitest.dev/guide/migration
- https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `_bmad-output/project-context.md`
- `src/engine/remote.ts`
- `src/engine/remote-canonical.ts`
- `src/engine/remote-pull.ts`
- `src/engine/remote-merge.ts`
- `tests/public-api.test.ts`
- `tests/pod-canonical.integration.test.ts`

## Story Completion Status

- Story context regenerated by create-story workflow.
- Status set to `review`.
- Completion note: Story implementation validated against acceptance criteria and full verification gates.

## Change Log

- 2026-05-03: Executed dev-story workflow for Story 3.2; validated canonical post-attach reconciliation coverage and required repository gates; advanced status to `review`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved workflow customization for `bmad-dev-story` and loaded persistent facts from `_bmad-output/project-context.md`.
- Loaded full sprint status and selected first `ready-for-dev` story: `3-2-reconcile-supported-canonical-remote-changes-after-attach`.
- Updated sprint tracking from `ready-for-dev` to `in-progress` before execution.
- Verified existing story implementation coverage in `tests/public-api.test.ts` and `tests/pod-canonical.integration.test.ts` for post-attach canonical reconciliation.
- Ran targeted checks:
  - `npm run -s test -- tests/public-api.test.ts -t "post-attach canonical|canonical reconciliation|duplicate canonical reconciliation"`
  - `npm run -s test:pod -- tests/pod-canonical.integration.test.ts`
- Ran required full gates:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Confirmed all gates passed with no regressions.

### Completion Notes List

- Confirmed post-attach canonical reconciliation remains on the existing sync sequence (`push -> pull -> reconcile`) and canonical logic remains centralized.
- Confirmed acceptance-criteria coverage exists and passes for:
  - compatible canonical updates after attach
  - inspectable reconciliation markers (`entityProjected: true`, `logProjected: false`)
  - no duplicate reconciliation change when log replay already matches canonical state
- Confirmed focused real-Pod canonical reconciliation proof passes.
- Verified no unsupported/unsafe-edit policy scope was added in this story.
- Promoted story status to `review` after full validation gates passed.

### File List

- _bmad-output/implementation-artifacts/3-2-reconcile-supported-canonical-remote-changes-after-attach.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
