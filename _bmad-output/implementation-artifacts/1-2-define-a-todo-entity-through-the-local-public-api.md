# Story 1.2: Define a Todo Entity Through the Local Public API

Status: review

## Story

As a developer building a simple demo app,
I want to define a todo entity for local-first behavior without designing an ontology first,
so that I can model a realistic bounded example quickly through supported APIs.

## Acceptance Criteria

1. Given a developer is following the in-repo todo demo path, when they define the first application entity, then the example uses a todo entity with shallow fields appropriate to the supported Phase 1 model, and it avoids unsupported deep graph or arbitrary collaborative structures.
2. Given a developer defines the todo entity for the local-first demo, when they use the public API, then they do so through the supported entity-definition surface rather than internal modules, and the example makes the entity kind and identity rule explicit without requiring Pod-specific mapping at this stage.
3. Given a developer is completing the quick-start local workflow, when they read the example and its surrounding explanation, then they can understand how the todo entity participates in local save, read, update, delete, and list behavior, and they are not required to learn RDF or choose ontology terms before reaching first proof of value.
4. Given canonical Pod mapping is a later concern, when the developer finishes this story, then the local-first entity definition is ready to support later sync-related mapping work, and the design leaves a clear extension point for adding ontology and canonical RDF behavior in Epic 2.
5. Given a developer or LLM-assisted builder wants to reuse the todo pattern, when they inspect the completed story outcome, then they can identify the minimum supported pattern for defining one bounded local-first entity in `lofipod`, and the example is small enough to serve as a reliable starting point for later sync stories in the demo.

## Tasks / Subtasks

- [x] Lock the implementation scope to the current public API contract (AC: 2, 4)
  - [x] Treat `defineEntity(...)` as unchanged for this story unless an intentional API redesign is approved separately.
  - [x] Keep the implementation on supported entrypoints such as `lofipod` or `lofipod/node`; do not introduce deep imports from internal modules.
  - [x] Preserve the framework-agnostic root package boundary and avoid pulling browser- or Node-specific concerns into core exports.
- [x] Make the demo's first entity a clearly reusable bounded todo pattern (AC: 1, 2, 5)
  - [x] Update the demo entity layer so the first entity is clearly the minimal todo/task example for the repo's local-first path.
  - [x] Keep fields shallow and bounded. A safe baseline is the current `id`, `title`, completion/status field, and optional due date. Avoid nested graphs or collaborative collection structures.
  - [x] Make the entity kind and identity rule obvious in code and docs.
- [x] Reduce ontology friction without hiding the existing API contract (AC: 2, 3, 4)
  - [x] Keep RDF details behind a small demo-owned vocabulary/helper surface rather than forcing the reader to invent terms from scratch.
  - [x] Do not claim that RDF mapping is absent if the code still depends on `rdfType`, `toRdf(...)`, and `project(...)`.
  - [x] Present Pod/canonical concerns as implementation details the demo already supplies, while leaving a clean extension point for Epic 2 sync work.
- [x] Align the quick-start and demo explanation with the implemented todo entity (AC: 3, 5)
  - [x] Update the surrounding docs or demo comments so the todo pattern is the first concept a new developer sees after Story 1.1.
  - [x] Explain how the entity flows into `save`, `get`, `list`, `delete`, and the demo CLI without making the reader study internals first.
  - [x] Reconcile the current "task" naming in the demo with the planning-doc "todo" wording deliberately; avoid half-renames.
- [x] Protect the existing demo and public-surface behavior with tests (AC: 3, 5)
  - [x] Add or update behavior-focused tests around the demo path if the entity shape, naming, or docs-visible workflow changes.
  - [x] Keep `tests/demo-cli.test.ts` green if CLI task commands remain the first proof-of-value surface.
  - [x] If public examples or exported contracts change, update the relevant public-API-facing tests and docs together.

## Dev Notes

### Story Intent

This story is about making the first bounded entity pattern obvious and reusable for the local-only path. It is not an excuse to redesign the entity-definition API, remove RDF from the core contract, or jump ahead into Pod sync behavior. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:262), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:13), [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:225)]

### Critical Guardrails

- `defineEntity(...)` currently requires `kind`, `pod.basePath`, `rdfType`, `id(...)`, `toRdf(...)`, and `project(...)`. Do not write the story implementation as if a local-only entity can be defined without RDF metadata unless you are intentionally changing the public API and corresponding docs/tests. [Source: [src/entity.ts](/media/michal/data/code/lofipod/src/entity.ts:1), [src/types.ts](/media/michal/data/code/lofipod/src/types.ts:29)]
- The root package must remain environment-neutral and framework-agnostic. If demo code needs SQLite or Solid adapter behavior, keep that in `demo/` or the `lofipod/node` entrypoint only. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18)]
- Keep the entity shallow. The accepted model supports primitive scalars, optional unordered primitive sets, and small bounded structures only; deep graph semantics are explicitly out of scope. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:29)]
- Treat "todo" vs "task" carefully. The planning docs say "todo", but the current demo, CLI, and quick-start path use `Task` and `task` commands. Either keep `Task` as the concrete todo example or rename consistently across code, tests, and docs in one pass. Do not leave mixed terminology. [Source: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:18), [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:64), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:28)]
- Do not break Story 1.3 before it starts. The next story depends on the demo entity already participating cleanly in local CRUD through the current app and CLI flow. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:295)]

### Current Codebase State

#### `demo/entities.ts`

Current state:
- Defines `Task` and `JournalEntry` plus the demo-owned `demoVocabulary` helper.
- `TaskEntity` already uses the supported public surface via `defineEntity<Task>(...)`.
- The current task graph includes `title`, `status`, and optional `due`.
- `JournalEntryEntity` references tasks through `aboutTaskId`, so any task-identity or URI changes have downstream impact.

What this story likely changes:
- Make the task/todo entity the explicit minimal local-first example.
- Possibly simplify naming, structure, or comments so new developers can reuse it as the canonical first entity pattern.
- If you refactor vocabulary or helper layout, keep the later sync path viable.

What must be preserved:
- Stable identity derivation.
- Deterministic `toRdf(...)` and `project(...)`.
- Compatibility with `demo/app.ts`, journal linkage, and later canonical sync stories.

Source: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)

#### `demo/app.ts`

Current state:
- Wires the demo through `createEngine(...)` using `demoEntities` and SQLite-backed local storage.
- Exposes the concrete local-first operations that Story 1.3 depends on: add/list/complete task plus journal operations.
- Uses `TaskEntity.kind` as the task storage key and assumes current task fields.

What this story likely changes:
- Align the app API with any deliberate entity rename or simplification.
- Possibly introduce clearer naming or helper usage so the todo pattern is easier to follow.

What must be preserved:
- Existing local CRUD flow shape.
- SQLite-backed local persistence wiring.
- Separation between local app behavior and later Pod sync concerns.

Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)

#### `demo/cli.ts`

Current state:
- The current first-run UX is command-driven and task-centric.
- `task add`, `task list`, and `task done` are already the first proof-of-value path documented in Story 1.1.

What this story likely changes:
- Only update the CLI if the entity naming or visible workflow must change to satisfy the story cleanly.

What must be preserved:
- The documented commands from Story 1.1 unless you intentionally update docs and tests together.
- Simple local-first proof-of-value before sync.

Source: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)

#### `docs/QUICKSTART.md`

Current state:
- Already shows a minimal local task example through `defineVocabulary(...)`, `defineEntity(...)`, `createEngine(...)`, and `createMemoryStorage()`.
- This is the clearest existing public example of the entity-definition contract.

What this story likely changes:
- Tighten the relationship between the quick-start `Task` example and the in-repo demo's first entity so they do not feel like separate patterns.

What must be preserved:
- Honest representation of the current API, including explicit RDF mapping.
- Root-entrypoint, framework-agnostic guidance.

Source: [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)

### Architecture Compliance

- Keep the public surface intentionally small: `defineVocabulary(...)`, `defineEntity<T>(...)`, `createEngine(...)`, CRUD methods, and existing adapter entrypoints. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18)]
- Treat entity definitions as the contract between application objects, local persistence, and canonical Pod resources. A "todo entity" story still sits inside that contract. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:48)]
- Keep the local-first engine behavior primary. Pod-backed sync stays later in the story arc. [Source: [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:17), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:118)]
- If you discover that Story 1.2 genuinely requires changing the accepted entity-definition contract, update `docs/API.md` and likely `docs/ADR.md` in the same implementation. Do not leave such a change implicit.

### Previous Story Intelligence

- Story 1.1 deliberately made the first-run path local-only and pointed new developers at the task-oriented demo before sync.
- The review finding on Story 1.1 shows the risk pattern here: docs and example commands must match the actual demo behavior exactly.
- Story 1.2 should therefore prefer incremental alignment of real demo code and docs over aspirational wording or a greenfield sample disconnected from the current repository.

Source: [1-1-explain-the-local-first-promise-and-first-run-path.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-1-explain-the-local-first-promise-and-first-run-path.md:1)

### Git Intelligence

Recent commits:
- `55d97c7` `story 1.1`
- `ac3cd59` `planning the work with bmad-method`
- `e130515` `design documents`

Actionable takeaways:
- The previous story already changed the public onboarding path, so this story should build directly on those docs instead of creating a competing path.
- The planning/design work is recent; prefer aligning with the accepted docs and generated planning artifacts rather than inferring a brand-new direction from older code history.

Source: `git log --oneline -5`

### Testing Requirements

- Minimum story-level checks should include `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` if the environment permits. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1), [AGENTS.md](/media/michal/data/code/lofipod/AGENTS.md:1)]
- Prefer behavior-focused tests through public or documented demo surfaces rather than tests tightly coupled to internals. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:11)]
- If you touch `defineEntity(...)` semantics, expect updates to `tests/public-api.test.ts` in addition to demo tests. The current test suite already treats entity validation as a public contract. [Source: `rg -n "defineEntity\\(" tests/public-api.test.ts`]

### Latest Technical Information

- The repo currently pins `typescript` `^6.0.3`. TypeScript 6.0 is now officially documented, and it is a transition release toward TypeScript 7.0 with deprecations that should not be reintroduced during this story. Prefer code that stays clean under strict modern TS settings already used by the repo. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- The repo currently pins `vitest` `^4.1.4`. Vitest 4 requires Node `>=20`, and its migration guide notes changed coverage remapping and removed deprecated APIs. Avoid introducing deprecated Vitest patterns when adding or editing tests. Source: https://vitest.dev/guide/migration.html
- The repo targets Node `>=24` in `package.json`. As of March 24, 2026, Node `24.14.1` is an LTS release line, so keeping the demo and tests aligned with Node 24 features remains a safe baseline. Source: https://nodejs.org/en/blog/release
- The repo uses `n3` `^2.0.3`, while npm shows the latest `n3` release as `1.26.0`. That mismatch is notable, but this story is not a dependency-upgrade story. Do not "fix" it opportunistically unless you confirm the package actually resolves and builds correctly in this repo and you are intentionally taking on upgrade risk. Source: https://www.npmjs.com/package/n3

### Implementation Strategy Notes

- Prefer extending the existing `TaskEntity` example rather than creating a second competing first-entity example.
- If you want to reduce RDF exposure for the first-run reader, do it by encapsulating demo-specific vocabulary setup or tightening docs, not by pretending the API no longer requires RDF hooks.
- Keep `JournalEntryEntity` working. It is already a consumer of the task/todo identity model and will become relevant again in later demo stories.
- Avoid broad renames across sync paths, ontology assets, and tests unless the payoff is clear and the rename is done consistently.

### Project Structure Notes

- Root public API boundary: [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- Node adapter boundary used by the demo: [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)
- Demo first-run docs: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- Core architecture baseline: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [src/entity.ts](/media/michal/data/code/lofipod/src/entity.ts:1)
- [src/types.ts](/media/michal/data/code/lofipod/src/types.ts:1)
- [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [tests/entrypoints.test.ts](/media/michal/data/code/lofipod/tests/entrypoints.test.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:262)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [1-1-explain-the-local-first-promise-and-first-run-path.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-1-explain-the-local-first-promise-and-first-run-path.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Story target auto-discovered from `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-2-define-a-todo-entity-through-the-local-public-api`
- No separate UX artifact was present in `_bmad-output/planning-artifacts`
- Planning docs and live code revealed a key scope tension: Story 1.2 wants less ontology friction, but the current public `defineEntity(...)` API still requires RDF hooks and Pod placement metadata
- Latest-technology spot checks were taken from official TypeScript, Vitest, and Node sources plus npm package metadata for `n3`
- Red phase started by tightening `tests/demo-cli.test.ts` to expect the bounded task shape without task timestamps
- Build, lint, unit, demo, and Pod integration checks passed after trimming the demo task entity and aligning docs
- `npm run verify` remains blocked by pre-existing Prettier warnings in unrelated repository files: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`, `docs/architecture.md`, `docs/project-overview.md`, and `docs/project-scan-report.json`

### Implementation Plan

- Keep the current public `defineEntity(...)` contract unchanged and stay on supported entrypoints
- Trim the demo task entity to a minimal shallow todo shape: `id`, `title`, `status`, and optional `due`
- Preserve the existing `task` CLI command surface while documenting that it is the repo's concrete todo pattern
- Align `docs/QUICKSTART.md` and `docs/API.md` with the implemented bounded task/todo example
- Prove the smaller task shape through the demo regression suite and full repo validations

### Completion Notes List

- Reworked the demo task entity into the minimal bounded todo pattern by keeping only `id`, `title`, `status`, and optional `due`, while preserving the supported `defineEntity(...)` contract and the `task` CLI surface.
- Renamed the demo-owned vocabulary helper to `demoVocabulary` and added a focused comment so the first entity pattern is easier to reuse without hiding the RDF mapping contract.
- Updated `docs/QUICKSTART.md`, `docs/API.md`, and `demo/README.md` so the first documented local-first pattern matches the implemented demo entity and explicitly explains the `save`/`get`/`list`/`delete` flow.
- Tightened `tests/demo-cli.test.ts` to lock the bounded task shape in place and verified that the existing CLI and persistence behavior still pass.
- Validation run summary: `npm run build`, `npm run lint`, `npm test`, `npm run test:demo`, and `npm run test:pod` passed; `npm run verify` is still blocked by unrelated pre-existing Prettier warnings elsewhere in the repo.

### File List

- `_bmad-output/implementation-artifacts/1-2-define-a-todo-entity-through-the-local-public-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `demo/README.md`
- `demo/app.ts`
- `demo/entities.ts`
- `docs/API.md`
- `docs/QUICKSTART.md`
- `tests/demo-cli.test.ts`

## Change Log

- 2026-04-26: Implemented the bounded todo/task demo pattern, aligned the quick-start and API docs to that pattern, and updated demo regression coverage for the smaller entity shape.
