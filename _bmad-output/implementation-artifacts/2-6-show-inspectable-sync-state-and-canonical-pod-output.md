# Story 2.6: Show Inspectable Sync State and Canonical Pod Output

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer validating sync behavior,
I want to inspect sync state and canonical Pod-side todo data,
so that I can understand what synchronized and trust the remote representation.

## Acceptance Criteria

1. Given the sync-enabled todo demo has local and remote activity, when a developer inspects the supported sync-state surface, then they can determine whether sync is attached, whether work is pending, and whether the system is currently healthy enough to continue background synchronization, and this inspection uses supported public behavior rather than hidden internals.
2. Given local todo changes have been synchronized to the remote target, when a developer inspects the canonical Pod-side representation, then they can see todo data stored in the documented canonical RDF form, and the representation is understandable as user-controlled data rather than opaque app-private state.
3. Given the sync path has experienced recent successful or pending work, when the developer compares local demo behavior with sync state and canonical output, then they can understand what has already synchronized and what remains pending, and the explanation remains consistent with the local-first mental model.
4. Given the project intends to support future user-controlled remote backends beyond Solid Pods, when a developer reviews the sync inspection and canonical-output documentation, then it is clear which parts are specific to the current Solid Pod implementation, and the architecture remains understandable as a storage-agnostic local-first core with pluggable remote synchronization targets.
5. Given the todo demo is used as an early sync trust proof, when this story is complete, then the repository gives developers a concrete, repeatable way to inspect both sync status and remote canonical data, and that inspection path supports later diagnostics and recovery stories without changing the core programming model.

## Tasks / Subtasks

- [x] Expose an inspectable sync-state path through supported public behavior. (AC: 1, 3, 5)
  - [x] Add or extend public-API-focused tests around `engine.sync.state()` so the supported state surface proves attached/unconfigured, pending/idle/offline/syncing, and health-related connection details without using internal helpers.
  - [x] Reuse the existing `SyncState` shape and status taxonomy where possible; do not invent a second diagnostics model if the current public surface already carries the required meaning.
  - [x] If demo-facing output changes, keep it a thin presentation over the supported public state rather than a demo-only source of truth.
- [x] Make the demo inspection flow concrete and repeatable. (AC: 1, 2, 3, 5)
  - [x] Extend the demo sync-status path and/or documentation so a developer can tell whether sync is configured, whether work remains pending, and whether the last known connection state is healthy enough for background progress.
  - [x] Document exactly how to inspect canonical task resources under the current Solid-backed demo mapping, including the `tasks/<id>.ttl` path and the expected RDF terms.
  - [x] Keep the inspection workflow small and stable; prefer one or two repeatable commands plus direct canonical resource inspection over a large new CLI diagnostics surface.
- [x] Prove canonical Pod output remains understandable and user-controlled. (AC: 2, 3, 4)
  - [x] Add or extend integration coverage that syncs demo task data, inspects the remote Turtle resource, and verifies the documented canonical RDF shape is what the developer sees.
  - [x] Make clear in code or docs that canonical Turtle inspection is Solid-specific transport/output, while the core library remains storage-agnostic and framework-agnostic.
  - [x] Avoid introducing new app-private-only output paths that obscure the canonical resource story.
- [x] Preserve scope boundaries with later explainability stories. (AC: 3, 5)
  - [x] Do not turn Story 2.6 into a full event log, migration report, or foreign-change diagnostics API.
  - [x] Keep richer recovery/explainability work for Epic 3; Story 2.6 should establish inspection basics that those later stories can build on.
- [x] Validate with the expected repo gates after implementation. (AC: 1-5)
  - [x] Run `npm run verify`.
  - [x] Run `npm run build`.
  - [x] Run `npm run test:demo`.
  - [x] Run `npm run test:pod`.

## Dev Notes

### Story Intent

Story 2.5 proved that attached sync survives temporary outages without breaking local-first use. Story 2.6 is the next trust slice: make the supported sync-state surface and the canonical Pod-side task representation inspectable enough that a developer can understand whether work is pending, whether sync is healthy, and what the remote RDF actually looks like. This is primarily an inspection-and-proof story, not a new synchronization architecture story. [Source: `_bmad-output/planning-artifacts/epics.md`, Story 2.6; `_bmad-output/planning-artifacts/prd.md`, FR26/FR45/FR46 and diagnostics journey]

### Critical Guardrails

- Reuse supported public surfaces first. `engine.sync.state()` already exists and carries status, pending count, and connection details; prefer surfacing or documenting that meaning over adding a parallel API. [Source: `docs/API.md`, Sync surface; `src/types.ts`]
- Preserve the existing sync-state taxonomy: `unconfigured`, `offline`, `syncing`, `idle`, and `pending`. Story 2.6 should clarify and prove those states, not destabilize them. [Source: `src/types.ts`; `src/engine/sync-state.ts`]
- Keep the root `lofipod` package environment-neutral and framework-agnostic. Any Pod-specific inspection affordance belongs in demo/docs or adapter-facing code, not in core exports that would blur package boundaries. [Source: `README.md`; `docs/ADR.md`; `_bmad-output/project-context.md`]
- Keep canonical inspection focused on the documented Turtle resource under `tasks/<id>.ttl`. Do not replace the canonical-data story with an opaque app-private debug dump. [Source: `demo/entities.ts`; `demo/README.md`; `demo/ontology/README.md`]
- Do not expand this story into broad failure analysis, migration reporting, or foreign-change policy handling. Those belong to Epic 3 and Epic 4. [Source: `_bmad-output/planning-artifacts/epics.md`, Stories 3.1-3.6 and Epic 4]

### Epic Context

Epic 2 is the background-sync proof track:

- 2.1 attached sync without changing local CRUD.
- 2.2 added ontology-backed canonical mapping and Pod projection.
- 2.3 imported Pod-backed canonical data into fresh local state.
- 2.4 handled mixed local/remote first attach.
- 2.5 proved offline local use and reconnect retry behavior.
- 2.6 now makes sync state and canonical output inspectable.
- 2.7 will use that trust surface in a multi-device consistency proof.

This story depends on the earlier slices remaining intact and should give later diagnostics stories a concrete inspection baseline instead of inventing new core programming concepts. [Source: `_bmad-output/planning-artifacts/epics.md`, Epic 2]

### Current Codebase State

#### `src/types.ts`

Current state:
- `SyncState` already exposes `status`, `configured`, `pendingChanges`, and a `connection` object with `reachable`, `lastSyncedAt`, `lastFailedAt`, `lastFailureReason`, and `notificationsActive`.
- The public engine surface already includes `sync.state()` and `sync.onStateChange(...)`.

What this story should change:
- Prefer no new engine API if the current `SyncState` contract is sufficient.
- If a small public-surface refinement is truly needed, keep it additive and documented through `docs/API.md`.

What must be preserved:
- The public sync surface stays small and explicit.
- No deep internal sync/storage structures leak through new exports.

Source: `src/types.ts`; `docs/API.md`

#### `src/engine/sync-state.ts`

Current state:
- Derived state is calculated from persisted metadata, pending local changes, and runtime flags.
- `offline` is driven by recorded failure metadata, `syncing` by runtime activity, `pending` by unprojected changes, and `idle` by zero pending work with reachable sync.

What this story should change:
- Most likely documentation/tests or presentation logic rather than the derivation model itself.
- If status semantics are confusing in practice, clarify them without breaking the existing state machine.

What must be preserved:
- `pendingChanges` remains based on unsynced local changes.
- Connection health remains derived from actual sync outcomes, not speculative network probing.

Source: `src/engine/sync-state.ts`; `docs/architecture.md`, Sync and Remote Orchestration

#### `demo/cli.ts`

Current state:
- `sync status` currently prints only `status`, `configured`, and `pending`.
- `sync bootstrap` and `sync now` provide explicit Pod-attached operations for the process-based demo.

What this story should change:
- This is the most likely place to improve inspectability for the in-repo workflow.
- Any output expansion should remain compact, stable, and easy to relate back to `SyncState`.

What must be preserved:
- The CLI remains small.
- Task and journal commands remain local-first and do not require live Pod attachment.

Source: `demo/cli.ts`; `demo/README.md`

#### `demo/app.ts`

Current state:
- The demo app is a thin wrapper around `createEngine(...)`, SQLite storage, and optional runtime `sync.attach(...)`.
- `syncState()`, `syncNow()`, and `syncBootstrap()` already expose the main sync operations used by the CLI.

What this story should change:
- Probably little or no architecture change.
- If CLI or docs need stronger sync-state inspection, keep this module a thin pass-through instead of embedding inspection policy here.

What must be preserved:
- The core package boundary stays clean.
- Pod adapter setup remains explicit and Node-only in the demo layer.

Source: `demo/app.ts`; `docs/architecture.md`, Source Tree and Responsibilities

#### `demo/entities.ts`

Current state:
- `TaskEntity` defines the canonical task resource under `tasks/<id>.ttl`.
- The canonical task graph uses `mlg:Task`, `schema:name`, `mlg:status`, and optional `mlg:due`.

What this story should change:
- Very likely nothing in the entity mapping itself unless documentation/tests expose a mismatch.
- Use this file as the source of truth for explaining canonical task output.

What must be preserved:
- Canonical task resources remain shallow and understandable.
- The same entity definition continues to bridge local shape and canonical Pod representation.

Source: `demo/entities.ts`; `demo/ontology/README.md`

#### `demo/README.md` and `demo/ontology/README.md`

Current state:
- `demo/README.md` already explains the sync commands and states that canonical task resources live under `tasks/<id>.ttl`.
- `demo/ontology/README.md` already documents the `mlg` namespace and example canonical task Turtle.

What this story should change:
- Tighten these docs into an explicit inspection walkthrough instead of leaving the canonical-output path as implied context.
- Make the distinction between storage-agnostic core behavior and Solid-specific canonical inspection explicit.

What must be preserved:
- The first proof remains local-first.
- Pod inspection remains additive to the local workflow, not a prerequisite for it.

Source: `demo/README.md`; `demo/ontology/README.md`

#### `tests/demo-pod.integration.test.ts`

Current state:
- The suite already checks demo `sync status` output and verifies canonical task resources in the open test Pod.
- It already proves create/update/delete flow against canonical task resources.

What this story should change:
- Extend this suite to become the repeatable trust proof for inspecting sync status and canonical output together.
- Assert the documented sync-status meaning and canonical RDF inspection path more directly.

What must be preserved:
- Integration scope stays focused and behavior-oriented.
- Assertions stay on supported CLI behavior and remote resource content, not internal implementation details.

Source: `tests/demo-pod.integration.test.ts`; `docs/TESTING.md`

#### `tests/public-api.test.ts` and `tests/pod-auto-sync.integration.test.ts`

Current state:
- Public API coverage already exercises `engine.sync.state()` transitions such as `offline`, `idle`, and pending behavior.
- Pod integration coverage already proves automatic retry and recovery after temporary failure.

What this story should change:
- Reuse these suites if a gap remains in proving the meaning of the public sync-state surface.
- Prefer extending existing tests over creating a parallel diagnostics-only suite.

What must be preserved:
- Public-API-first testing stance.
- Focused real-Pod checks rather than broad, slow integration sprawl.

Source: `tests/public-api.test.ts`; `tests/pod-auto-sync.integration.test.ts`; `docs/TESTING.md`

### Recommended Implementation Shape

1. Start from the current public `SyncState` contract and verify whether the missing piece is proof/documentation, demo formatting, or a minimal API refinement.
2. If `sync status` output changes, make it a direct rendering of `engine.sync.state()` fields so the demo reflects the public contract instead of inventing its own semantics.
3. Document one clear canonical-inspection path for the demo, likely by reading `tasks/<id>.ttl` directly from the Pod after a sync command.
4. Extend existing demo and public-API tests to prove both sync-state inspection and canonical Turtle inspection.
5. Avoid adding a new "debug API", hidden internal command, or storage-specific core abstraction just to satisfy this story.

### Previous Story Intelligence

- Story 2.5 deliberately stopped short of building a richer inspectability surface and treated Story 2.6 as the dedicated inspection slice. Preserve that sequencing.
- Story 2.5 confirmed that the current sync-state model already distinguishes `offline`, `pending`, and `idle`; Story 2.6 should capitalize on that rather than redesign it.
- Epic 2 implementation has been landing as engine/test/demo/docs vertical slices. Continue that pattern here.

Source: `_bmad-output/implementation-artifacts/2-5-keep-local-use-working-through-offline-and-reconnect-cycles.md`

### Git Intelligence

Recent commits:
- `fe8eb3c` `improving tests`
- `dae6a79` `surviving intermittent connectivity`
- `444e316` `handle first attach with pre-existing data on both sides`
- `f8dfc3b` `importing pod backed data`
- `849ee61` `ontology mapping`

Actionable takeaways:
- Epic 2 has been evolving by tightening proof and tests around an already-established architecture rather than reopening the architecture each story.
- Demo README and integration tests are part of the delivery pattern, not optional cleanup.
- Story 2.6 should probably be an incremental inspection/documentation/proof slice built on top of existing sync-state and canonical-resource work.

Source: `git log --oneline -5`; `git show --stat --oneline --summary HEAD`; `git show --stat --oneline --summary HEAD~1`

### Testing Requirements

- Required local gates for substantive implementation:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prefer a mix of:
  - public API coverage that proves the supported sync-state contract is meaningful and stable
  - demo integration coverage that proves a real inspection workflow over sync status plus canonical Turtle
  - focused real-Pod verification rather than ad hoc internal probing

Source: `docs/TESTING.md`; `_bmad-output/project-context.md`

### Latest Technical Information

- Node.js `v24` is an LTS release line as of April 15, 2026, and the official release table lists `v24.15.0` as the latest LTS branch release on that date. This remains aligned with the repo's Node `>=24` baseline for CLI and polling-based sync tests.
  Source: https://nodejs.org/en/about/previous-releases
- Vitest 4's official migration guide says Vitest 4 requires Vite `>=6.0.0` and Node.js `>=20.0.0`, so the repo's Node 24 baseline remains comfortably within supported test-runner requirements.
  Source: https://main.vitest.dev/guide/migration
- Inrupt's current Node.js authentication guidance still uses `@inrupt/solid-client-authn-node` and a `Session`-based flow for Node environments, which reinforces the existing architecture rule that Solid authentication/runtime concerns stay in Node/browser adapter layers rather than the framework-agnostic core.
  Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Project Structure Notes

- Planning artifacts contain `epics.md` and `prd.md` under `_bmad-output/planning-artifacts`.
- A planning-artefact `architecture.md` file is absent; the active architecture baseline is `docs/architecture.md` together with `docs/ADR.md` and `docs/API.md`.
- UX-specific planning artifacts are absent; UX and developer-experience intent comes from the PRD, epics, README, and demo docs.
- Most likely files to update:
  - `demo/cli.ts`
  - `demo/README.md`
  - `demo/ontology/README.md`
  - `tests/demo-pod.integration.test.ts`
  - possibly `tests/public-api.test.ts`
  - possibly `src/types.ts` or `docs/API.md` only if the current public `SyncState` contract proves insufficient

### References

- `README.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `docs/architecture.md`
- `docs/TESTING.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/2-5-keep-local-use-working-through-offline-and-reconnect-cycles.md`
- `src/types.ts`
- `src/engine/sync-state.ts`
- `demo/app.ts`
- `demo/cli.ts`
- `demo/entities.ts`
- `demo/README.md`
- `demo/ontology/README.md`
- `tests/demo-pod.integration.test.ts`
- `tests/public-api.test.ts`
- `tests/pod-auto-sync.integration.test.ts`
- `tests/pod-open.integration.test.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow`
- `date --iso-8601=seconds`
- `git log --oneline -5`
- `git show --stat --oneline --summary HEAD`
- `git show --stat --oneline --summary HEAD~1`
- `sed -n '1,260p' README.md`
- `sed -n '1,260p' docs/ADR.md`
- `sed -n '1,260p' docs/API.md`
- `sed -n '1,260p' docs/PLANS.md`
- `sed -n '1,260p' docs/WIP.md`
- `sed -n '1,320p' docs/architecture.md`
- `sed -n '1,260p' docs/TESTING.md`
- `sed -n '1,260p' demo/README.md`
- `sed -n '1,220p' demo/ontology/README.md`
- `sed -n '1,260p' src/types.ts`
- `sed -n '1,260p' src/engine/sync-state.ts`
- `sed -n '1,320p' demo/cli.ts`
- `sed -n '1,260p' demo/app.ts`
- `sed -n '1,240p' demo/entities.ts`
- `sed -n '120,280p' tests/demo-pod.integration.test.ts`
- `sed -n '240,330p' tests/pod-auto-sync.integration.test.ts`
- `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-dev-story --key workflow`
- `sed -n '1,260p' _bmad/bmm/config.yaml`
- `sed -n '1,260p' _bmad-output/implementation-artifacts/sprint-status.yaml`
- `sed -n '1,320p' _bmad-output/implementation-artifacts/2-6-show-inspectable-sync-state-and-canonical-pod-output.md`
- `sed -n '1,260p' _bmad-output/project-context.md`
- `rg -n "sync status|status=unconfigured|status=syncing|pending=" tests/demo-pod.integration.test.ts tests/public-api.test.ts demo/cli.ts demo/README.md`
- `sed -n '1,260p' tests/demo-pod.integration.test.ts`
- `sed -n '1,240p' tests/public-api.test.ts`
- `sed -n '1580,1925p' tests/public-api.test.ts`
- `sed -n '220,420p' tests/demo-pod.integration.test.ts`
- `sed -n '145,240p' demo/README.md`
- `sed -n '1,180p' demo/ontology/README.md`
- `npx vitest run tests/public-api.test.ts`
- `npx vitest run tests/demo-pod.integration.test.ts`
- `npx vitest run --config vitest.pod.config.ts tests/demo-pod.integration.test.ts`
- `npx vitest run tests/demo-cli.test.ts tests/public-api.test.ts`
- `node --import tsx demo/cli.ts sync status --data-dir /tmp/lofipod-dev-story-smoke`
- `npx prettier --check demo/cli.ts`
- `npx prettier --write demo/cli.ts`
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

### Implementation Plan

- Reuse the existing `SyncState` contract unless a narrow additive improvement is necessary.
- Strengthen the demo inspection workflow with compact status output plus explicit canonical Turtle inspection guidance.
- Prove the workflow through demo integration tests and public-API sync-state coverage.

### Completion Notes List

- Added a compact multiline demo sync-state view in `demo/cli.ts` that renders the supported `SyncState` fields directly, including last-known connection metadata.
- Added a fast default-suite CLI regression in `tests/demo-cli.test.ts` for unconfigured and pending local sync inspection output without requiring Pod attachment.
- Strengthened `tests/public-api.test.ts` to assert explicit connection metadata for unconfigured, pending, idle, and syncing states.
- Extended `tests/demo-pod.integration.test.ts` to verify the inspectable CLI output and canonical task Turtle inspection path against the real Solid server flow.
- Updated `demo/README.md` and `demo/ontology/README.md` with an explicit inspection walkthrough and a clearer boundary between storage-agnostic core behavior and Solid-specific canonical output.
- Verified the implementation with `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-6-show-inspectable-sync-state-and-canonical-pod-output.md`
- `demo/README.md`
- `demo/cli.ts`
- `demo/ontology/README.md`
- `tests/demo-cli.test.ts`
- `tests/demo-pod.integration.test.ts`
- `tests/public-api.test.ts`

### Change Log

- 2026-05-02: Implemented Story 2.6 by exposing inspectable demo sync-state output, documenting canonical Pod inspection, and extending CLI, public API, and Pod integration coverage.
