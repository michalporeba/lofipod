# Story 3.1: Replay Compatible Remote Changes From Another Lofipod Client

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer using the same dataset from multiple `lofipod` instances,
I want supported remote changes from another client to be replayed into my local state,
So that ongoing multi-device use remains consistent after initial attach.

## Acceptance Criteria

1. Given two compatible `lofipod` clients are connected to the same remote dataset after initial attach is complete, when one client creates, updates, or deletes supported todo data, then the other client can discover and replay those supported remote changes into its local state, and the resulting local state remains usable through the normal local read model.
2. Given the remote changes were produced through the same documented `lofipod` conventions, when they are replayed into another client, then the system treats them as supported ongoing changes rather than as unsafe foreign edits, and the replay behavior remains within the documented bounded model.
3. Given the receiving client already has local state for the affected todo entities, when compatible remote changes are replayed, then reconciliation follows the documented CRDT-light policy for supported cases, and the outcome is deterministic and consistent across clients.
4. Given remote replay occurs after sync is already attached and functioning, when the developer reviews the behavior through the demo and supporting documentation, then it is clear that this story covers ongoing compatible remote changes rather than first attach or bootstrap import, and the explanation distinguishes replay behavior from manual or unsupported remote edits.
5. Given the repository is demonstrating trust in ongoing multi-device use, when this story is complete, then the in-repo workflow proves that one `lofipod` client can safely absorb supported changes produced by another, and this proof remains small enough to support later diagnostics and recovery stories.

## Tasks / Subtasks

- [x] Prove supported replay from another client through the public API and sync engine. (AC: 1, 2, 3, 5)
  - [x] Extend `tests/public-api.test.ts` with a two-engine scenario that writes supported changes from one engine, replays them on another, and asserts the receiver’s `get(...)` and `list(...)` results through the local read model.
  - [x] Cover supported create, update, and delete replay, plus the expected deterministic outcome when the receiver already has local state for the same entity.
  - [x] Reuse the existing remote log replay and fork reconciliation behavior in `src/engine/remote-pull.ts` and `src/engine/remote-merge.ts`; do not introduce a second replay pipeline or a new public API.
- [x] Add a repo-level multi-client proof that stays inside the bounded supported model. (AC: 1, 2, 4, 5)
  - [x] Extend `tests/demo-pod.integration.test.ts` or `tests/pod-auto-sync.integration.test.ts` with a second client or second local demo instance over the same shared Pod dataset.
  - [x] Prefer assertions against visible demo behavior, sync state, and remote canonical/log content instead of internal storage details.
  - [x] Keep the scenario focused on compatible ongoing replay after attach, not first-attach import, bootstrap recovery, or unsupported foreign-edit handling.
- [x] Preserve the demo and docs boundary if the story needs clarification text. (AC: 4, 5)
  - [x] If the replay story is unclear from the existing demo text, add a short clarification to `demo/README.md` that distinguishes post-attach replay from bootstrap import.
  - [x] Keep the demo process-based and local-first; do not turn the CLI into a daemon or add a special replay command.
- [x] Validate with the expected repo gates after implementation. (AC: 1-5)
  - [x] Run `npm run verify`.
  - [x] Run `npm run build`.
  - [x] Run `npm run test:demo`.
  - [x] Run `npm run test:pod`.

## Dev Agent Record

### Debug Log

- Added a new public API regression covering two-client create/update/delete replay and deterministic reconciliation when the receiver had pre-existing local state.
- Added a new Community Solid Server integration proving ongoing post-attach replay across two attached clients for create/update/delete.
- Fixed one TypeScript issue in the new public API test by using an explicit `podBaseUrl` string instead of reading a missing field from the local pod fixture.

### Completion Notes

- Story 3.1 implementation completed through tests without changing core engine behavior.
- Existing remote replay and reconciliation paths were reused; no second replay pipeline or public API changes were introduced.
- All required repo gates passed: `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

## File List

- tests/public-api.test.ts
- tests/pod-auto-sync.integration.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-1-replay-compatible-remote-changes-from-another-lofipod-client.md

## Change Log

- 2026-05-03: Added Story 3.1 replay proofs in public API and Pod integration tests; validated full repo gates; moved story to `review`.

## Dev Notes

### Story Intent

Story 3.1 is the first Epic 3 trust slice. Epic 2 already proved attach, bootstrap, inspectable sync state, canonical Pod output, offline recovery, and a two-instance proof path. This story now proves the next step: a second compatible client can absorb ongoing remote changes produced by another client, and the local read model remains the normal place the application reads from. The story should stay narrow and behavior-focused, not become a new sync architecture slice. [Source: `_bmad-output/planning-artifacts/epics.md`, Story 3.1 and Epic 3; `_bmad-output/implementation-artifacts/2-7-demonstrate-multi-device-todo-consistency-through-the-in-repo-workflow.md`; `docs/PLANS.md`]

### Critical Guardrails

- Keep the root package framework-agnostic and environment-neutral. Any demo- or Solid-specific behavior belongs in the demo, adapter layers, or tests, not in shared core exports. [Source: `README.md`; `docs/ADR.md`; `docs/architecture.md`]
- Reuse the current remote replay flow rather than inventing a second sync path. `src/engine/remote-pull.ts` already replays log entries into local graph state, and `src/engine/remote-merge.ts` already reconciles supported forks deterministically. [Source: `src/engine/remote-pull.ts`; `src/engine/remote-merge.ts`; `docs/architecture.md`]
- Preserve the attach/bootstrap boundary. This story is about ongoing post-attach replay of compatible remote changes, not first-attach import or mixed local/remote bootstrap reconciliation. [Source: `_bmad-output/planning-artifacts/epics.md`, Story 3.1 and Story 3.2; `docs/ADR.md`]
- Keep the bounded model intact: shallow entities, per-triple change records, local-first reads, and CRDT-light deterministic reconciliation only within the supported constraints. [Source: `docs/ADR.md`; `docs/WIP.md`]
- Do not conflate supported replay with unsupported or unsafe foreign edits. Those are separate Epic 3 stories and should not be solved here. [Source: `_bmad-output/planning-artifacts/epics.md`, Stories 3.3-3.4]

### Epic Context

Epic 3 is the trust, recovery, and explainability track:

- 3.1 replays compatible remote changes from another `lofipod` client.
- 3.2 reconciles supported canonical remote changes after attach.
- 3.3 detects and classifies unsupported or unsafe remote edits.
- 3.4 applies documented policy responses to unsupported remote changes.
- 3.5 explains what changed, what synced, and what failed.
- 3.6 recovers cleanly from interrupted or failed sync work.

This story should establish the supported replay baseline that later stories can classify, explain, and recover from. [Source: `_bmad-output/planning-artifacts/epics.md`, Epic 3]

### Current Codebase State

#### `src/engine/remote-pull.ts`

Current state:
- Replays remote log entries into local graph state.
- Skips remote change IDs already seen locally or previously observed.
- Appends replayed entries to local change history with their timestamps and parent IDs.
- Triggers fork reconciliation after replay.

What this story should change:
- Most likely no engine rewrite is needed.
- If replay semantics are not already proven by tests, add or extend tests that exercise this code path through the public engine surface.

What must be preserved:
- Existing idempotency for already-observed remote changes.
- Replay into the local read model rather than a separate query path.
- Fork reconciliation after replay.

Source: `src/engine/remote-pull.ts`; `docs/architecture.md`

#### `src/engine/remote-merge.ts`

Current state:
- Detects forks by `parentChangeId`.
- Merges supported branch snapshots by touched subject/predicate keys.
- Resolves competing branch snapshots deterministically by timestamp, then lexicographic `changeId`.

What this story should change:
- Usually no code change unless the test reveals a real gap in the supported replay path.

What must be preserved:
- Deterministic merge ordering.
- Preservation of local graph semantics during replay.

Source: `src/engine/remote-merge.ts`; `docs/ADR.md`

#### `src/engine.ts`

Current state:
- `sync.now()` already sequences push, pull, and canonical reconciliation.
- Attach/poll behavior is already serialized and background-oriented.

What this story should change:
- Probably nothing unless the receiving-client proof reveals a gap in sync orchestration.

What must be preserved:
- Local commits still happen before remote sync work.
- Sync stays background-oriented and serialized.

Source: `src/engine.ts`; `docs/architecture.md`

#### `tests/public-api.test.ts`

Current state:
- Already proves remote log replay into another engine.
- Already covers later remote updates, duplicate replay tolerance, remote deletions, bootstrap skip behavior, and several merge/fork cases.

What this story should change:
- Extend the existing replay coverage with the exact multi-client supported scenario required by Story 3.1.
- Prefer a clear public-API proof over a deeper internal-only test.

What must be preserved:
- Public-API-first testing stance.
- Existing deterministic replay and fork semantics.

Source: `tests/public-api.test.ts`; `docs/TESTING.md`

#### `tests/pod-auto-sync.integration.test.ts`

Current state:
- Proves automatic push after save, automatic pull on attach, polling-driven discovery, and retry after temporary failure.

What this story should change:
- Reuse the long-lived attached-engine patterns if the repo needs one more decisive proof of ongoing compatible replay.

What must be preserved:
- Polling-based correctness as the baseline.
- Focused real-Pod integration scope.

Source: `tests/pod-auto-sync.integration.test.ts`; `docs/ADR.md`

#### `tests/demo-pod.integration.test.ts`

Current state:
- Proves the demo CLI against Community Solid Server.
- Already covers canonical task sync, inspection, and bootstrap import behavior.

What this story should change:
- If the repository-level proof is best shown through the demo workflow, extend this suite with a second-client replay scenario.

What must be preserved:
- Behavior-oriented assertions through visible demo output and remote Pod content.
- The demo remains a small CLI workflow, not a new sync subsystem.

Source: `tests/demo-pod.integration.test.ts`; `demo/README.md`

#### `demo/README.md` and `demo/cli.ts`

Current state:
- The demo README already explains local-first behavior, sync attach, sync status, and canonical Pod output.
- The CLI is process-based and reopens the same local store on each run.

What this story should change:
- Usually no new CLI command is needed.
- If the replay story needs one line of clarification, document it in the README rather than expanding the command surface.

What must be preserved:
- Local-first commands stay local-first.
- Sync remains additive and runtime-attached.

Source: `demo/README.md`; `demo/cli.ts`

### Recommended Implementation Shape

1. Start with a failing test that proves one client’s supported create, update, and delete changes replay into another client after attach.
2. Reuse the current remote log replay and reconciliation logic; do not add a separate replay mode or a new diagnostics layer.
3. Assert the receiver’s outcome through `engine.get(...)`, `engine.list(...)`, and, if needed, stable demo-visible sync/canonical output.
4. Keep the scenario small and explicit enough that it clearly represents ongoing compatible remote replay, not bootstrap or unsafe foreign-edit handling.
5. Only touch the demo README if the current sync/replay narrative is still ambiguous after the test proves the behavior.

### Previous Story Intelligence

- Story 2.7 already established a two-instance trust proof at the repo level. Reuse that workflow style and keep the multi-client story concrete rather than abstract.
- Story 2.6 established inspectable sync state and canonical Pod output. If this story needs to explain progress or pending work, those inspection paths are already the right ones to reference.
- Epic 2 implementation has been landing as vertical slices across engine behavior, integration tests, and demo docs. Keep Story 3.1 aligned with that pattern.

Source: `_bmad-output/implementation-artifacts/2-7-demonstrate-multi-device-todo-consistency-through-the-in-repo-workflow.md`; `_bmad-output/implementation-artifacts/2-6-show-inspectable-sync-state-and-canonical-pod-output.md`

### Git Intelligence

Recent commits:

- `012910d` `demonstrate multi-device setup`
- `01bc19f` `inspectable sync state`
- `fe8eb3c` `improving tests`
- `dae6a79` `surviving intermittent connectivity`
- `444e316` `handle first attach with pre-existing data on both sides`

Actionable takeaways:

- The project has been proving sync behavior by tightening tests and docs around already-established engine semantics.
- Demo and integration tests are a normal place to make trust claims concrete.
- The first Epic 3 slice should stay test-driven and behavior-focused rather than broadening the public API.

Source: `git log --oneline -5`

### Latest Technical Information

- Node.js `v24` is an LTS line as of 2026-05-02, and the official release table lists `v24.15.0` as the latest LTS branch release. That remains aligned with the repo's Node `>=24` runtime target for CLI and polling-based sync tests. Source: https://nodejs.org/en/about/previous-releases
- Vitest 4's official migration guide says Vitest 4 requires Vite `>=6.0.0` and Node.js `>=20.0.0`, so the repo's Node 24 baseline remains comfortably supported for the test suites that prove replay behavior. Source: https://main.vitest.dev/guide/migration
- Inrupt's current Node.js authentication guidance still uses `@inrupt/solid-client-authn-node` and a `Session`-based flow for Node environments, which reinforces the existing rule that Solid authentication/runtime concerns stay in Node/browser adapter layers rather than the framework-agnostic core. Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Testing Requirements

- Required local gates for substantive implementation:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prefer:
  - one public-API test that proves compatible remote replay into another client
  - one repo-level integration proof over the demo or Pod harness
  - behavior assertions through the supported local read model

Source: `docs/TESTING.md`; `_bmad-output/project-context.md`

### Project Structure Notes

- Planning artifacts available: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`
- The active architecture baseline is `docs/architecture.md` together with `docs/ADR.md` and `docs/API.md`
- Most likely files to touch:
  - `tests/public-api.test.ts`
  - `tests/demo-pod.integration.test.ts`
  - `tests/pod-auto-sync.integration.test.ts`
  - `src/engine/remote-pull.ts`
  - `src/engine/remote-merge.ts`
  - maybe `demo/README.md`
- Avoid adding new public API surface unless the test evidence shows the current replay contract is insufficient.
