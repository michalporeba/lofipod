# Story 2.7: Demonstrate Multi-Device Todo Consistency Through the In-Repo Workflow

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer evaluating lofipod's sync promise,
I want a documented and testable multi-device todo scenario in the repository,
so that background sync across devices is proven, not just claimed.

## Acceptance Criteria

1. Given two supported local instances of the sync-enabled todo demo are connected to the same remote dataset, when a developer creates or updates todo items on one instance through the documented workflow, then the changes are eventually reflected in the other instance through the supported background synchronization path, and both instances continue to use their local read models as the primary operational surface.
2. Given one instance makes supported todo changes while the other is temporarily offline or disconnected, when connectivity is restored and background sync resumes, then the two instances converge to a consistent supported state according to the documented CRDT-light policy, and the convergence behavior is repeatable enough to serve as a trust proof for the bounded model.
3. Given both instances begin with existing supported local or remote state, when the documented attach and synchronization flow is followed, then the resulting behavior remains consistent with the earlier first-attach and reconciliation stories, and the demo does not require developers to manually choreograph synchronization steps for ordinary use.
4. Given a developer wants to validate what "multi-device" means in practice for lofipod, when they review the repository's demo and verification workflow, then they can run or inspect a concrete end-to-end scenario showing local-first usage, background sync, and eventual consistency across instances, and the scenario remains small enough to understand without reading internal implementation details.
5. Given Epic 2 is considered complete, when the sync-enabled todo demo, supporting docs, and verification workflow are reviewed together, then the repository demonstrates a coherent background-sync story from first attach through multi-device consistency, and it provides a stable basis for the later trust, diagnostics, and foreign-change stories.

## Tasks / Subtasks

- [ ] Add a demo-level two-instance convergence proof over one shared Pod dataset. (AC: 1, 2, 4, 5)
  - [ ] Extend `tests/demo-pod.integration.test.ts` or add an adjacent demo-focused integration test that creates two separate local demo data directories and proves task changes flow from one instance to the other.
  - [ ] Reuse the existing demo app wiring and Pod mapping instead of inventing a second demo sync path or test-only dataset model.
  - [ ] Assert behavior through supported demo operations and visible state, not internal storage details.
- [ ] Prove recovery and convergence after a disconnected period. (AC: 2, 3)
  - [ ] Cover the case where one instance is behind or temporarily disconnected, then later catches up to the remote state.
  - [ ] Keep convergence expectations inside the currently supported bounded model for shallow task entities and deterministic conflict resolution.
  - [ ] Reuse the existing polling or explicit sync orchestration already present in the engine and demo layers rather than introducing a new "multi-device mode."
- [ ] Document the repeatable repo workflow for two demo instances. (AC: 1, 3, 4, 5)
  - [ ] Update `demo/README.md` with a small two-device walkthrough that uses separate `--data-dir` values and one shared Pod base URL.
  - [ ] Explain clearly where the CLI workflow is process-based and where the underlying library behavior is background or polling-driven in long-lived use.
  - [ ] Keep the explanation aligned with the earlier attach, bootstrap, canonical inspection, and offline/reconnect stories.
- [ ] Preserve established sync semantics and scope boundaries. (AC: 2, 3, 5)
  - [ ] Do not redesign `SyncState`, bootstrap semantics, canonical mapping, or reconciliation rules just to tell the multi-device story.
  - [ ] Do not expand this slice into foreign-change policy, rich diagnostics, or new cross-application interoperability features; those belong to Epic 3 and beyond.
  - [ ] If a small demo helper refinement is needed, keep it additive and local to demo/test layers where possible.
- [ ] Validate with the expected repo gates after implementation. (AC: 1-5)
  - [ ] Run `npm run verify`.
  - [ ] Run `npm run build`.
  - [ ] Run `npm run test:demo`.
  - [ ] Run `npm run test:pod`.

## Dev Notes

### Story Intent

Story 2.6 made sync state and canonical Pod output inspectable. Story 2.7 is the capstone of Epic 2: prove that the same bounded todo model behaves coherently across two local instances using one shared remote dataset. The goal is trust proof, not a new synchronization subsystem. The implementation should make "multi-device" concrete at the repo level while staying consistent with the local-first programming model, the existing attach/bootstrap flow, and the current bounded reconciliation policy. [Source: `epics.md`, Story 2.7; `prd.md`, FR25 and multi-device trust framing]

### Critical Guardrails

- Keep the root `lofipod` package framework-agnostic and environment-neutral. Any Solid- or demo-specific behavior belongs in demo code, docs, or Node adapter layers, not core exports. [Source: `README.md`; `docs/ADR.md`; `_bmad-output/project-context.md`]
- Reuse the existing synchronization architecture: local commit first, then queued remote push/pull work, polling as the reliability backstop, and canonical resource plus log replay as the remote model. Do not add a parallel multi-device orchestration layer. [Source: `docs/ADR.md`; `docs/architecture.md`; `docs/WIP.md`]
- Preserve the current bounded model: shallow entities, deterministic reconciliation, and no general-purpose collaborative editing semantics. Story 2.7 proves supported convergence, not arbitrary CRDT behavior. [Source: `docs/ADR.md`; `docs/WIP.md`; `prd.md`]
- Keep first-attach/bootstrap semantics intact. If a second instance starts from empty local state, use the existing bootstrap or attach behavior instead of bypassing earlier Epic 2 decisions. [Source: `_bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md`; `docs/ADR.md`]
- Avoid overpromising background behavior in the process-based CLI. The CLI can demonstrate the workflow, but long-lived automatic polling behavior should be proven in tests through the existing engine and demo app layers rather than by bending the CLI into a daemon. [Source: `demo/README.md`; `demo/app.ts`; `tests/pod-auto-sync.integration.test.ts`]

### Epic Context

Epic 2 has established this sequence:

- 2.1 attached Pod sync without changing local CRUD.
- 2.2 added ontology-backed canonical task mapping and Pod projection.
- 2.3 imported Pod-backed canonical data into fresh local state.
- 2.4 handled mixed local and remote first-attach cases.
- 2.5 proved offline local use and reconnect recovery.
- 2.6 made sync state and canonical Pod output inspectable.
- 2.7 now needs to demonstrate the full multi-device trust proof across two instances.

This story should finish Epic 2 without broadening the public model. Epic 3 can then build on this proof for replay, diagnostics, and foreign-change handling. [Source: `epics.md`, Epic 2 and Epic 3]

### Current Codebase State

#### `demo/app.ts`

Current state:
- `createDemoApp(...)` builds the demo around `createEngine(...)`, SQLite storage, and explicit runtime `sync.attach(...)`.
- Demo sync attachment is already a thin wrapper over the Node-side adapter path.
- `syncState()`, `syncNow()`, and `syncBootstrap()` are already exposed for test and CLI use.

What this story should change:
- If the demo-level multi-device proof needs short polling intervals or another small attach-time option, extend this wrapper additively rather than bypassing it.
- Keep this module a thin orchestration layer rather than embedding demo-specific reconciliation logic.

What must be preserved:
- The root package boundary stays clean.
- Node-specific sync setup remains explicit and isolated to the demo layer.

Source: `demo/app.ts`; `docs/architecture.md`

#### `demo/cli.ts`

Current state:
- The CLI supports local task and journal commands plus `sync bootstrap`, `sync status`, and `sync now`.
- It is intentionally process-based: each command reopens the same local store and optionally reattaches sync.

What this story should change:
- Probably little or no command-surface expansion.
- If help text or output needs clarification for the two-device workflow, keep it small and consistent with the existing sync command set.

What must be preserved:
- The CLI remains compact.
- Task and journal commands remain local-first and do not require live Pod attachment.

Source: `demo/cli.ts`; `demo/README.md`

#### `demo/README.md`

Current state:
- The README already documents local-first usage, sync attach commands, sync inspection, canonical Pod inspection, and bootstrap recovery.
- It currently stops short of a concrete two-instance walkthrough.

What this story should change:
- Add one explicit multi-device walkthrough using separate local data directories and one shared Pod base URL.
- Explain how the repo-level proof relates to the long-lived background-sync model without implying that the CLI itself is a persistent attached app shell.

What must be preserved:
- The first proof remains local-first first.
- Pod sync stays additive to the local workflow.

Source: `demo/README.md`

#### `tests/demo-pod.integration.test.ts`

Current state:
- The suite already proves canonical task sync, update/delete behavior, and bootstrap import using the demo CLI against the Community Solid Server.
- It already has the remote-resource and status-output helpers needed for a demo-facing trust scenario.

What this story should change:
- Extend the suite into a two-instance trust proof using separate local demo directories over one shared Pod.
- Prefer visible task state and canonical-resource assertions over internal database inspection.

What must be preserved:
- Focused integration scope.
- Behavior-oriented assertions through the demo workflow.

Source: `tests/demo-pod.integration.test.ts`; `docs/TESTING.md`

#### `tests/pod-auto-sync.integration.test.ts`

Current state:
- The suite already proves automatic push after local save, automatic pull on attach, polling-driven remote discovery, and retry after temporary failure.
- This is the strongest existing proof that background behavior is real in a long-lived attached engine.

What this story should change:
- Reuse its patterns and expectations when deciding how much of the multi-device proof should be direct demo-app integration versus CLI workflow coverage.
- Extend it only if the repo lacks one decisive background convergence proof for the bounded task model.

What must be preserved:
- Polling-based correctness remains the baseline.
- Real Pod integration stays focused.

Source: `tests/pod-auto-sync.integration.test.ts`; `docs/ADR.md`

#### `tests/public-api.test.ts`

Current state:
- The public API suite already contains multi-engine scenarios around remote pull, canonical reconciliation, deletion replay, and deterministic conflict resolution.
- These tests prove important lower-level semantics that Story 2.7 should not re-implement in the demo layer.

What this story should change:
- Reuse these existing semantics as the library-level foundation and add only the missing repo-level demo proof.
- If a gap exists in task-shaped or demo-shaped convergence semantics, extend an existing section rather than creating a disconnected test surface.

What must be preserved:
- Public-API-first testing stance.
- Deterministic reconciliation rules already exercised in the engine suite.

Source: `tests/public-api.test.ts`; `docs/TESTING.md`

### Recommended Implementation Shape

1. Start by deciding the minimum repo-level proof that is still honest about background behavior:
   - a two-directory demo CLI workflow for documentation and trust
   - one automated two-instance integration proof using the demo app or demo CLI over a shared Pod
2. Reuse `createDemoApp(...)` and current sync attachment semantics if a long-lived two-instance integration test is needed.
3. Keep the task entity and canonical mapping unchanged unless the multi-device proof exposes a real defect.
4. Align the documentation with the actual verification path so the demo remains understandable without reading internals.
5. Treat Story 2.7 as the final Epic 2 narrative slice, not as an excuse to add a new API surface.

### Previous Story Intelligence

- Story 2.6 intentionally established inspectable sync state and canonical output as the trust baseline. Story 2.7 should build directly on those inspection paths rather than inventing a different verification story.
- Story 2.5 already proved offline and reconnect behavior. Reuse that behavior as part of the two-instance convergence story instead of duplicating reconnect architecture.
- Epic 2 work has been landing as vertical slices across engine behavior, demo/docs, tests, and implementation artifacts. Continue that pattern here.

Source: `_bmad-output/implementation-artifacts/2-6-show-inspectable-sync-state-and-canonical-pod-output.md`; `_bmad-output/implementation-artifacts/2-5-keep-local-use-working-through-offline-and-reconnect-cycles.md`

### Git Intelligence

Recent commits:

- `01bc19f` `inspectable sync state`
- `fe8eb3c` `improving tests`
- `dae6a79` `surviving intermittent connectivity`
- `444e316` `handle first attach with pre-existing data on both sides`
- `f8dfc3b` `importing pod backed data`

Actionable takeaways:

- Epic 2 implementation has been converging by tightening proof and docs around an already-established architecture.
- Demo README changes are part of the normal delivery surface, not optional cleanup.
- Integration tests are the preferred place to make trust claims concrete before broadening API or CLI surface area.

Source: `git log --oneline -5`; `git show --stat --oneline --name-only 01bc19f`; `git show --stat --oneline --name-only fe8eb3c`; `git show --stat --oneline --name-only dae6a79`

### Latest Technical Information

- Node.js 24 is still the correct baseline for this repo. The official release table lists `v24.15.0` as the latest LTS release and marks `v24` as LTS, which remains aligned with the project's `Node.js >=24` development target. Source checked on 2026-05-02: https://nodejs.org/en/about/previous-releases
- Vitest 4's official migration guide states that Vitest 4 requires `Node.js >= 20.0.0` and `Vite >= 6.0.0`, so the repo's Node 24 baseline remains comfortably supported for multi-instance integration tests and CLI-driven regression checks. Source checked on 2026-05-02: https://vitest.dev/guide/migration.html
- Inrupt's current Node.js authentication guidance still uses `@inrupt/solid-client-authn-node` and a `Session`-based flow for Node-side Solid access. That supports the existing architecture rule that authentication and Pod runtime concerns stay in Node/browser adapter layers, not the framework-agnostic core. Source checked on 2026-05-02: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Testing Requirements

- Required local gates for substantive implementation:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prefer a mix of:
  - one repo-level two-instance trust proof in the demo integration layer
  - existing public API and Pod auto-sync tests as the semantic foundation
  - documentation that mirrors the verified workflow exactly

Source: `docs/TESTING.md`; `_bmad-output/project-context.md`

### Project Structure Notes

- Planning artifacts available: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`
- No separate planning-artifact `architecture.md` or UX file exists under `_bmad-output/planning-artifacts`; use `docs/architecture.md` plus `docs/ADR.md` and `docs/API.md` as the active architecture baseline.
- Most likely files to update:
  - `demo/README.md`
  - `tests/demo-pod.integration.test.ts`
  - possibly `demo/app.ts`
  - possibly `demo/cli.ts`
  - possibly `tests/pod-auto-sync.integration.test.ts`
- Avoid changes in the root public API unless the demo proof exposes a genuine contract gap.

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
- `_bmad-output/implementation-artifacts/2-6-show-inspectable-sync-state-and-canonical-pod-output.md`
- `demo/app.ts`
- `demo/cli.ts`
- `demo/README.md`
- `demo/entities.ts`
- `demo/ontology/README.md`
- `tests/demo-pod.integration.test.ts`
- `tests/pod-auto-sync.integration.test.ts`
- `tests/public-api.test.ts`
- `src/types.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow`
- `date --iso-8601=seconds`
- `git log --oneline -5`
- `git show --stat --oneline --name-only 01bc19f`
- `git show --stat --oneline --name-only fe8eb3c`
- `git show --stat --oneline --name-only dae6a79`
- `sed -n '1,260p' README.md`
- `sed -n '1,260p' docs/ADR.md`
- `sed -n '1,260p' docs/API.md`
- `sed -n '1,260p' docs/PLANS.md`
- `sed -n '1,260p' docs/WIP.md`
- `sed -n '1,340p' docs/architecture.md`
- `sed -n '1,260p' docs/TESTING.md`
- `sed -n '1,320p' demo/README.md`
- `sed -n '1,260p' demo/ontology/README.md`
- `sed -n '1,360p' demo/cli.ts`
- `sed -n '1,260p' demo/app.ts`
- `sed -n '1,260p' demo/entities.ts`
- `sed -n '1,320p' tests/demo-pod.integration.test.ts`
- `sed -n '321,520p' tests/demo-pod.integration.test.ts`
- `sed -n '1,260p' tests/demo-cli.test.ts`
- `sed -n '1,260p' tests/pod-auto-sync.integration.test.ts`
- `sed -n '1,220p' tests/pod-open.integration.test.ts`
- `sed -n '4940,5065p' tests/public-api.test.ts`
- `sed -n '5240,5395p' tests/public-api.test.ts`

### Completion Notes List

- Created comprehensive developer context for Story 2.7 with implementation guardrails, likely file touch points, and testing expectations.
- Kept the story scoped to a repo-level multi-device trust proof on top of existing engine semantics.
- Implemented repo-facing multi-device proof artifacts in the codebase, including the two-directory demo integration scenario and README workflow guidance.
- Reconciled workflow tracking to `review` based on implemented repository state; full local verification commands were not re-run during this tracking update.

### File List

- `_bmad-output/implementation-artifacts/2-7-demonstrate-multi-device-todo-consistency-through-the-in-repo-workflow.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
