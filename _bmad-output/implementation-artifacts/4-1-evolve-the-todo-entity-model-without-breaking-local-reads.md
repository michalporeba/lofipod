# Story 4.1: Evolve the Todo Entity Model Without Breaking Local Reads

Status: done

## Story

As a developer improving the demo app,
I want to change the supported todo model over time,
so that the app can evolve without stranding existing local data.

## Acceptance Criteria

1. Given the in-repo todo demo already has stored local data using an earlier supported todo model, when the developer introduces a new supported version of the todo entity model, then the application can still read previously stored todo data through the local-first workflow, and the change remains within the documented bounded evolution path.
2. Given the todo model changes in a way supported by the Phase 1 architecture, when the updated application code starts using the new model, then the developer is not required to discard existing local data or rebuild the dataset from scratch, and local read behavior remains available while later migration or repair work takes place.
3. Given a developer is evaluating whether model evolution is a supported feature or an accidental side effect, when they review the demo and documentation for this story, then it is clear bounded entity-model evolution is part of the intended product contract, and the explanation distinguishes supported model changes from arbitrary schema or RDF mutation expectations.
4. Given the project aims to make local-first and Pod-backed app building practical over time, when this story is complete, then the repository demonstrates a supported todo model can evolve without immediately breaking basic local reads, and this forms the baseline for later reprojection, migration, and canonical compatibility stories.

## Tasks / Subtasks

- [x] Introduce a bounded v2 change to the demo task model in `demo/entities.ts` that is explicitly compatible with reading legacy stored task data. (AC: 1, 2)
- [x] Preserve local-first read continuity in the same workflow (`task get`, `task list`) while evolution logic is applied lazily or deterministically. (AC: 1, 2)
- [x] Keep evolution behavior inside existing entity projection/canonicalization pathways; do not add out-of-band migration tooling in this story. (AC: 2, 4)
- [x] Add/extend behavior-focused tests showing legacy local records are still readable after the model update. (AC: 1, 2)
- [x] Update demo/docs language so model evolution is presented as a supported bounded contract, not accidental behavior. (AC: 3, 4)
- [x] Keep scope bounded to local-read continuity baseline; defer reprojection/migration/canonical transition details to stories 4.2-4.4. (AC: 4)

## Dev Notes

### Epic Context

- Epic 4 target: safe evolution of data and application semantics.
- Story 4.1 is the baseline for 4.2-4.6: prove local reads survive a supported model evolution before adding full reprojection and migration outcomes.
- This story must demonstrate trust-preserving continuity, not full migration completion.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)]

### Story Foundation and Constraints

- Keep the root package framework-agnostic and environment-neutral.
- Keep bounded scope: shallow entities, explicit deterministic mapping, no arbitrary RDF mutation support.
- Evolution in 4.1 must not require dataset discard/rebuild.
- Local-first guarantee is primary: read availability must be preserved while evolution work is introduced.

[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]

### Current State: Relevant UPDATE Files to Read Before Changes

- `demo/entities.ts`
  - Current state: `Task` shape is `id`, `title`, `status`, optional `due`; `TaskEntity.project(...)` reconstructs directly from `schema:name`, `mlg:status`, optional `mlg:due`.
  - 4.1 change target: evolve the supported task model while keeping legacy local records readable.
  - Must preserve: deterministic ID extraction, bounded entity shape, explicit status term validation, canonical mapping discipline.

- `src/engine/local.ts`
  - Current state: `getEntity(...)`/`listEntities(...)` run `repairStoredProjection(...)`, providing existing read-path repair hooks.
  - 4.1 change target: rely on existing read/repair semantics to keep local reads working through supported model change.
  - Must preserve: append-only change behavior, no hidden destructive rewrites, public API behavior.

- `demo/app.ts`
  - Current state: task CRUD flows through `TaskEntity` with local-first `engine.save/get/list`.
  - 4.1 change target: keep task CRUD CLI/app path operational with legacy persisted local data.
  - Must preserve: command-level behavior and compatibility with existing demo workflows.

- `demo/cli.ts`
  - Current state: task output formatting assumes stable readable task shape.
  - 4.1 change target: keep CLI read paths stable if evolved fields are introduced.
  - Must preserve: deterministic output style and no sync-coupling for local commands.

- `tests/demo-entities.test.ts`
  - Current state: validates bounded task RDF mapping and projection invariants.
  - 4.1 change target: add regression coverage for legacy-read compatibility under evolved model.
  - Must preserve: explicit checks for supported terms and deterministic projection.

- `tests/demo-cli.test.ts`
  - Current state: checks inspectability and local CLI behavior around persisted state.
  - 4.1 change target: verify local read commands remain usable after model evolution.
  - Must preserve: behavior-first assertions.

### Implementation Guardrails

- Do not introduce React/UI-framework assumptions.
- Do not require full migration orchestration in this story; this is local-read continuity baseline only.
- Do not silently broaden supported schema/RDF mutation surface beyond documented bounded model.
- Prefer extending existing projection/repair paths over adding parallel compatibility codepaths.
- Keep canonical Pod semantics stable enough for later stories; avoid premature remote migration logic here.

### Architecture Compliance

- Keep entrypoint boundaries intact: `lofipod` core remains neutral; environment-specific behavior stays under `lofipod/node` and `lofipod/browser`.
- Treat entity definitions as persistence/sync contracts.
- If accepted architecture constraints are materially changed, update `docs/ADR.md`.
- If public API behavior/expectations change, update `docs/API.md`.

### Testing Requirements

Required gates before completion:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:

- `npx vitest tests/demo-entities.test.ts -t "task|project|round-trips|legacy|compat"`
- `npx vitest tests/demo-cli.test.ts -t "task|get|list|sync status"`
- `npx vitest tests/sqlite-storage.test.ts -t "read|list|projection|repair"`

### Previous Story Intelligence

- No prior story in Epic 4 exists yet; use Epic 3 outputs only as reliability/test-discipline precedent.
- Recent story patterns favored narrow, behavior-first increments and explicit diagnostics over broad rewrites.

### Git Intelligence Summary

Recent commits emphasize incremental trust/recovery hardening:

- `23be562` recover from interruptions
- `146c355` explanations of failures
- `12e7e0b` unsafe remote edits
- `6c5ec98` reconcile supported canonical changes
- `6cf45e2` replay compatible remote changes

Actionable takeaway: maintain small, test-first, contract-preserving changes with explicit docs alignment.

### Latest Tech Information (Verified 2026-05-03)

- Node.js release line status: Node `v24` is listed as LTS, and `v25` is Current.
- TypeScript 6.0 is officially announced and available.
- Vitest docs current major line is v4 (site shows `v4.1.5`).

Use this story with current repo constraints (`Node >=24`, strict TypeScript, Vitest 4) and avoid introducing newer runtime/tool assumptions unless intentionally upgraded.

### Project Structure Notes

Primary implementation surface for this story:

- `demo/entities.ts`
- `demo/app.ts`
- `demo/cli.ts`
- `tests/demo-entities.test.ts`
- `tests/demo-cli.test.ts`
- optional targeted docs updates in `demo/README.md` and `docs/API.md`

Avoid introducing new top-level migration subsystems in 4.1.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/architecture.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `_bmad-output/project-context.md`
- `demo/entities.ts`
- `demo/app.ts`
- `demo/cli.ts`
- `src/engine/local.ts`
- `tests/demo-entities.test.ts`
- `tests/demo-cli.test.ts`
- https://nodejs.org/en/about/previous-releases
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- https://vitest.dev/

## Story Completion Status

- Story context created with full artifact analysis and implementation guardrails.
- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Resolved next backlog story from sprint status: `4-1-evolve-the-todo-entity-model-without-breaking-local-reads`.
- Loaded and analyzed epics, PRD, architecture, ADR/API/PLANS/WIP, project context, and relevant code paths.
- Reviewed current demo entity/projection/read pathways and tests for compatibility guidance.
- Reviewed recent git history to preserve implementation patterns.
- Verified latest tech references (Node/TypeScript/Vitest) for current-version guardrails.
- Added bounded task-model v2 field (`priority`) in `demo/entities.ts` with backward-compatible projection default for legacy graphs missing the new predicate.
- Updated demo app task creation in `demo/app.ts` to populate `priority: "normal"` for new tasks.
- Added/updated behavior tests in `tests/demo-entities.test.ts` and `tests/demo-cli.test.ts` to verify legacy-read compatibility and stable local CLI read workflow.
- Updated docs in `demo/README.md` and `docs/API.md` to state bounded model-evolution support explicitly.
- Ran required gates: `npm run verify`, `npm run build`, `npm run test:demo`, `npm run test:pod` (Docker-based run executed outside sandbox).

### Completion Notes List

- Created Story 4.1 implementation context with AC-to-task mapping.
- Added concrete file-level guidance for model-evolution read compatibility.
- Included architecture boundaries and bounded-scope guardrails.
- Captured verification gates and focused test recommendations.
- Implemented bounded task model evolution by introducing `priority` while preserving local read compatibility for legacy task graphs.
- Ensured legacy tasks without a priority triple are still readable through deterministic default projection (`priority: "normal"`).
- Preserved task CLI read/list behavior while evolving the entity contract.
- Added regression coverage for evolved and legacy task projection paths and for stable local CLI outputs.
- Updated developer docs to describe bounded model-evolution behavior as intentional contract.

### File List

- _bmad-output/implementation-artifacts/4-1-evolve-the-todo-entity-model-without-breaking-local-reads.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- demo/entities.ts
- demo/app.ts
- demo/cli.ts
- tests/demo-entities.test.ts
- tests/demo-cli.test.ts
- demo/README.md
- docs/API.md

## Change Log

- 2026-05-03: Implemented bounded task-model evolution baseline (v2 priority field with legacy-read compatibility), added regression coverage, updated docs, and passed verify/build/demo/pod validation gates.
