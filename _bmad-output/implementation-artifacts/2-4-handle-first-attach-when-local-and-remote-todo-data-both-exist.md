# Story 2.4: Handle First Attach When Local and Remote Todo Data Both Exist

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer connecting an existing local app to an existing Solid Pod,
I want first attach to handle local and remote todo data safely,
so that I do not lose data or silently overwrite conflicting state.

## Acceptance Criteria

1. Given a local todo dataset already exists and supported canonical remote todo data also already exists, when the developer attaches sync for the first time, then the system evaluates both sides through the documented first-attach policy, and it applies a deterministic automatic reconciliation policy within the supported bounded model rather than requiring manual conflict resolution for normal cases.
2. Given a remote todo exists that has no matching local entity, when first attach processes the remote dataset, then the missing remote todo is imported into local state, and the resulting local entity is available through the normal local read model.
3. Given a local todo exists that has no matching remote entity, when first attach processes the local dataset, then the local todo remains intact locally, and the documented sync policy determines whether it is queued for later projection rather than being discarded.
4. Given both local and remote sides contain the same logical todo with equivalent supported state, when first attach compares them, then the entity is treated as non-conflicting, and no unnecessary overwrite or duplicate import is performed.
5. Given both local and remote sides contain the same logical todo with differing supported state, when first attach compares them, then the system resolves the difference automatically according to the documented CRDT-light policy for the supported model, and the outcome is deterministic, inspectable, and consistent across devices.
6. Given first attach encounters a state difference outside the supported automatic resolution boundaries, when reconciliation cannot be completed safely within the documented bounded model, then the system surfaces that exceptional condition explicitly, and it preserves trust by avoiding silent data loss or undefined merge behavior.

## Tasks / Subtasks

- [x] Define and implement first-attach mixed-state reconciliation policy in engine bootstrap flow. (AC: 1, 5, 6)
  - [x] Replace current bootstrap collision-only behavior for supported mixed local/remote state with a deterministic automatic reconciliation path for bounded entities.
  - [x] Keep unsupported/unsafe differences explicit and inspectable; do not silently overwrite when outside supported boundaries.
  - [x] Ensure reconciliation outputs are machine-usable (counts, entity IDs, and classification per outcome) so CLI/docs can report trustable results.
- [x] Preserve additive import behavior while extending mixed-state handling. (AC: 2, 4)
  - [x] Keep remote-only entities imported into local state through normal entity `project(...)`.
  - [x] Keep graph-identical entities treated as non-conflicting and skipped.
  - [x] Prevent duplicate import/write churn for equivalent graphs.
- [x] Keep local-only entities safe and consistent with background sync model. (AC: 3)
  - [x] Preserve local-only entities as local state on first attach.
  - [x] Confirm local-only entities remain queued/eligible for normal projection via existing sync cycle logic; do not introduce a special one-off path that bypasses existing remote push semantics.
  - [x] Avoid any behavior that discards local-only entities during bootstrap or first attach.
- [x] Add focused regression coverage for mixed local/remote first-attach scenarios. (AC: 1-6)
  - [x] Extend public API bootstrap tests for remote-only import, local-only preservation, identical skip, supported deterministic merge, and unsupported-state surfacing.
  - [x] Keep real Pod integration focused; only add demo Pod test cases if demo-layer behavior or documentation requires explicit proof.
  - [x] Preserve existing Story 2.3 bootstrap behavior guarantees while adding mixed-state reconciliation coverage.
- [x] Update developer-facing docs to reflect first-attach mixed-state policy. (AC: 1, 3, 5, 6)
  - [x] Document the supported automatic reconciliation boundaries and deterministic tie-break policy for this bounded model.
  - [x] Document what gets surfaced as unsupported/unsafe and what the developer should inspect next.
  - [x] Keep quick-start/local-first-first narrative intact; this is a sync-stage behavior, not first-run onboarding.

## Dev Notes

### Story Intent

Story 2.3 intentionally stopped at collision reporting for mixed local/remote first attach. Story 2.4 is the handoff point where mixed state is now handled automatically for supported bounded cases, while still surfacing unsupported states explicitly. This is engine behavior first, with demo/docs proving trust and inspectability. [Source: [2-3-import-pod-backed-todo-data-into-fresh-local-state.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-3-import-pod-backed-todo-data-into-fresh-local-state.md:33), [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:499)]

### Critical Guardrails

- Do not introduce remote-first CRUD behavior. Local writes and reads remain local-first; first attach/reconciliation augments sync state only. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:79), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:57)]
- Keep root package framework-agnostic and environment-neutral. No Node/browser/Solid details should leak into core public root exports. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:27)]
- Reuse existing engine sync architecture (`bootstrap`, `sync.now`, pull, canonical reconciliation) instead of adding a demo-only merge subsystem. [Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:304), [src/engine/remote.ts](/media/michal/data/code/lofipod/src/engine/remote.ts:8)]
- Preserve bounded model scope. Do not expand into general RDF merge, deep graph semantics, or manual conflict UI workflows in this slice. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:29), [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:24)]

### Current Codebase State

#### `src/engine/remote-bootstrap.ts`

Current state:
- Imports missing remote entities into local.
- Skips identical local/remote entity graphs.
- Reports differing mixed-state entities as `collisions` without resolution.

What this story should change:
- Introduce deterministic automatic reconciliation for supported mixed-state differences.
- Keep explicit surfacing for unsupported differences.
- Preserve current remote-only import and identical skip semantics.

What must be preserved:
- Projection via entity `project(...)`.
- No silent data loss.
- Bootstrap remains explicit (`engine.sync.bootstrap()`), not automatic on local reads.

Source: [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:13), [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:5110)

#### `src/engine.ts`

Current state:
- `sync.attach(...)` persists config, starts polling/notifications, and queues background sync.
- `sync.bootstrap()` delegates directly to `bootstrapFromCanonicalResources(...)`.

What this story should change:
- Potentially evolve bootstrap result shape and lifecycle semantics if needed for inspectable reconciliation outcomes.
- Keep attach and queued background sync behavior intact.

What must be preserved:
- Local-first write path.
- Runtime attach/detach behavior.
- Existing sync cycle orchestration.

Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:195)

#### `tests/public-api.test.ts`

Current state:
- Already covers remote-only bootstrap import.
- Already covers identical skip and collision reporting.
- Already covers broader sync/pull/reconcile behavior in mocked adapter flows.

What this story should change:
- Update/extend bootstrap tests for deterministic mixed-state automatic reconciliation and unsupported-state surfacing.
- Keep behavior-focused assertions through public API.

What must be preserved:
- Existing passing expectations from Story 2.3 for additive import and non-overwrite guarantees, adjusted only where Story 2.4 explicitly changes behavior.

Source: [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:4980)

#### `demo/app.ts`, `demo/cli.ts`, `demo/README.md`

Current state:
- Demo exposes explicit `sync bootstrap` flow and reports `imported/skipped/collisions`.
- Documentation now explains bootstrap as explicit fresh-local recovery.

What this story should change:
- If bootstrap result semantics change, keep demo output and docs aligned and inspectable.
- Add demo-level coverage only where demo behavior meaningfully changes.

What must be preserved:
- Small CLI surface.
- Local-first-first narrative.

Source: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:248), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:180)

### Architecture Compliance Notes

- Canonical resources in Pod remain Turtle per-entity files (`tasks/<id>.ttl` etc.); logs remain N-Triples. Reconciliation must keep this boundary. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:50)]
- Pod is durability/interoperability layer, not operational query surface. After reconciliation, app reads remain local read-model backed. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:145)]
- Synchronization work is background-oriented and serialized; first-attach logic must not break queueing guarantees. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:63)]

### Previous Story Intelligence

- Story 2.1 established explicit runtime sync attach path; keep this as the integration pattern.
- Story 2.2/2.3 hardened canonical mapping and fresh-local bootstrap proof.
- Story 2.3 explicitly deferred mixed-state automatic reconciliation to this story.

Source: [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1), [2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md:1), [2-3-import-pod-backed-todo-data-into-fresh-local-state.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-3-import-pod-backed-todo-data-into-fresh-local-state.md:33)

### Git Intelligence

Recent commits:
- `f8dfc3b` `importing pod backed data`
- `849ee61` `ontology mapping`
- `1760afc` `attaching demo to a pod`
- `831603d` `version updates`
- `c1eb5bd` `a demo cli`

Actionable takeaways:
- Story work is landed as cohesive slices: implementation-artifact story + sprint-status + demo/docs/tests changes together.
- Sync-related stories evolved from attach -> mapping -> bootstrap; this story should continue that sequence in engine/test/docs, not a standalone demo-only patch.
- Keep dependency changes out unless directly required by first-attach reconciliation.

Source: `git log --oneline -5`, `git show --stat --oneline -1 f8dfc3b`, `git show --stat --oneline -1 849ee61`, `git show --stat --oneline -1 1760afc`

### Testing Requirements

- Expected verification for substantive implementation:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prioritize behavior-focused tests via public API and demo surface, not internals.
- Add high-value mixed-state first-attach scenarios (remote-only, local-only, identical, supported merge, unsupported surfacing).

Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:47), [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)

### Latest Technical Information

- TypeScript 6.0 docs are current and align with this repo’s strict modern ESM/bundler configuration; avoid legacy module-resolution guidance in new code/docs.
  Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest migration guidance confirms Vitest 4 requires Node.js `>=20`; repo baseline Node `>=24` remains compatible.
  Source: https://vitest.dev/guide/migration
- Node release table shows `v24 (Krypton)` remains LTS with last update on April 15, 2026.
  Source: https://nodejs.org/ja/about/previous-releases/
- Inrupt Node auth guidance continues to use `Session` and authenticated `fetch`; keep auth/session wiring in node/demo adapter layer, not core engine.
  Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Project Structure Notes

- Planning architecture artifact (`_bmad-output/planning-artifacts/architecture.md`) is absent; effective architecture baseline is [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1).
- UX-specific planning artifact is absent; UX guidance is taken from PRD/epics and existing docs.
- Primary code areas for this story:
  - engine bootstrap/reconciliation: `src/engine/remote-bootstrap.ts`, possibly adjacent engine sync modules
  - public API behavior tests: `tests/public-api.test.ts`
  - optional demo/docs sync output alignment: `demo/cli.ts`, `demo/README.md`, `tests/demo-pod.integration.test.ts`

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:396)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:1)
- [src/engine/remote.ts](/media/michal/data/code/lofipod/src/engine/remote.ts:1)
- [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:1)
- [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1)
- [2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md:1)
- [2-3-import-pod-backed-todo-data-into-fresh-local-state.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-3-import-pod-backed-todo-data-into-fresh-local-state.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /media/michal/data/code/lofipod/_bmad/scripts/resolve_customization.py --skill /media/michal/data/code/lofipod/.agents/skills/bmad-dev-story --key workflow`
- `cat README.md`
- `cat docs/ADR.md`
- `cat docs/API.md`
- `cat docs/PLANS.md`
- `cat docs/WIP.md`
- `cat _bmad-output/project-context.md`
- `cat _bmad-output/implementation-artifacts/sprint-status.yaml`
- `cat _bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md`
- `npx vitest run tests/public-api.test.ts -t bootstrap`
- `npm run format`
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

### Completion Notes List

- Implemented deterministic mixed-state first-attach reconciliation for supported bounded conflicts in `src/engine/remote-bootstrap.ts`.
- Added explicit unsupported mixed-state surfacing with machine-usable classification (`unsupported` + compatibility `collisions`) and preserved additive import/identical skip behavior.
- Extended bootstrap result surface with `reconciled` and `unsupported`, and updated bootstrap logging metadata.
- Added regression coverage for supported merge and unsupported surfacing in public API tests.
- Updated demo bootstrap output and docs to include reconciled/unsupported counts while preserving compatibility collision count.
- Updated architecture/API docs for first-attach mixed-state policy.
- Validation complete: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod`.

### File List

- src/engine/remote-bootstrap.ts
- src/types.ts
- src/engine.ts
- tests/public-api.test.ts
- demo/cli.ts
- tests/demo-pod.integration.test.ts
- demo/README.md
- docs/ADR.md
- docs/API.md
- _bmad-output/implementation-artifacts/2-4-handle-first-attach-when-local-and-remote-todo-data-both-exist.md

## Change Log

- 2026-05-02: Implemented Story 2.4 mixed local/remote first-attach reconciliation with deterministic supported merge, unsupported surfacing, API/test/demo/doc updates, and full validation pass.
