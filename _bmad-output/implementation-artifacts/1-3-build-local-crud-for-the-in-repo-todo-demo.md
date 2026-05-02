# Story 1.3: Build Local CRUD for the In-Repo Todo Demo

Status: review

## Story

As a developer validating lofipod,
I want the demo todo app to create, read, update, delete, and list todos locally,
so that the library proves useful before sync is introduced.

## Acceptance Criteria

1. Given the todo entity is defined through the public API, when a developer runs the in-repo demo in local-only mode, then they can create a todo item through the documented workflow, and the created item is immediately available through the local read path.
2. Given one or more todo items already exist locally, when the developer reads or lists todos through the demo, then the results come from the local-first engine behavior rather than any remote dependency, and the output reflects the current local state consistently.
3. Given an existing todo item is stored locally, when the developer updates one or more supported fields, then the updated values are returned by subsequent local reads and lists, and the workflow remains entirely within the supported public API surface.
4. Given an existing todo item is stored locally, when the developer deletes that item through the demo workflow, then it is no longer returned by local reads or lists, and the deletion behavior is observable through the documented demo path.
5. Given a developer is using the todo demo as the first proof of value, when they inspect the example and its supporting documentation, then they can see a complete local CRUD flow that is small, understandable, and framework-agnostic, and the demo does not require Pod setup, background sync, or internal implementation knowledge.

## Tasks / Subtasks

- [x] Close the local CRUD gap in the demo app API without changing the public engine contract (AC: 1, 2, 3, 4)
  - [x] Extend `DemoApp` in `demo/app.ts` with the missing task operations needed for a full local CRUD flow, while continuing to delegate persistence to `createEngine(...)` through supported entrypoints only.
  - [x] Keep the existing `addTask(...)`, `listTasks(...)`, and `completeTask(...)` flow intact unless a rename produces a clearly smaller and more coherent API.
  - [x] Add the missing delete path and at least one explicit single-item read path so the demo does not rely on list-only inspection for every task operation.
- [x] Keep task updates intentionally small and demo-friendly (AC: 3, 5)
  - [x] Treat the current `task done` flow as the minimum existing update path and preserve it unless a broader `task update` command is added deliberately.
  - [x] If broader updates are introduced, keep them bounded to the supported shallow task fields: `title`, `status`, and optional `due`.
  - [x] Do not turn this story into a generic editing framework, TUI effort, or sync feature.
- [x] Extend the CLI command surface to expose the completed local CRUD story cleanly (AC: 1, 2, 3, 4, 5)
  - [x] Update `renderHelp()` and `runCli()` in `demo/cli.ts` so the documented task workflow includes the missing local CRUD commands.
  - [x] Follow the existing command grammar of `task <verb>` and the existing stdout/stderr style instead of inventing a new CLI shape.
  - [x] Keep `journal` and `sync` commands working exactly as they do today.
- [x] Update demo documentation to match the actual command flow (AC: 1, 4, 5)
  - [x] Update `demo/README.md` so the first-run path shows the full supported local CRUD loop and remains explicitly local-only.
  - [x] Keep the quick-start and demo aligned: the quick-start explains the engine-level CRUD model, while the demo README shows the concrete CLI workflow built on top of it.
  - [x] Do not require a developer to read internal source files to discover the task CRUD flow.
- [x] Add or update behavior-focused regression coverage around the completed demo flow (AC: 1, 2, 3, 4, 5)
  - [x] Extend `tests/demo-cli.test.ts` for the new read/delete behavior and any CLI output changes.
  - [x] Add app-level tests only where the behavior is awkward to express through the CLI; prefer the documented user-facing path first.
  - [x] Keep the existing persistence-across-restart regression and journal/sync smoke coverage green.

## Dev Notes

### Story Intent

Story 1.3 is not about inventing a second demo or redesigning the engine. The repo already has the bounded task entity and a working local-first CLI path; the missing work is to make that path a complete, documented local CRUD demonstration. The implementation should therefore extend the current demo surface rather than replacing it. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:295), [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:17), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18)]

### Critical Guardrails

- Stay on supported public entrypoints. The demo app already imports `createEngine`, `createSqliteStorage`, and sync types from `../src/node.js`; do not bypass that with deep internal imports just to implement task commands faster. [Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:4), [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)]
- Keep the root package framework-agnostic and environment-neutral. Any CLI or SQLite-specific work belongs in `demo/` or the Node entrypoint path, not in `src/index.ts` or shared core modules. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:130), [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)]
- Do not regress the bounded task model from Story 1.2. `TaskEntity` is already the concrete todo example with `id`, `title`, `status`, and optional `due`; keep updates bounded to those fields and preserve deterministic RDF projection and rehydration. [Source: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:24), [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:20)]
- The sequencing in planning docs is slightly behind the live repo: the demo already uses SQLite-backed local storage and already has a restart regression. Story 1.3 should preserve that behavior, not re-scope it away, even though Story 1.4 is nominally about persistence across restart. [Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:69), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:146), [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:43)]
- Journal entries already reference tasks by task ID. Any change to task identity, task deletion behavior, or CLI-visible task naming must not accidentally break the journal path or leave orphaned assumptions in the demo. [Source: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:157), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:130), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:24)]

### Current Codebase State

#### `demo/app.ts`

Current state:
- `createDemoApp(...)` already creates a SQLite-backed engine and optionally attaches Pod sync.
- The task-facing API currently exposes only `addTask(...)`, `listTasks()`, and `completeTask(...)`.
- `completeTask(...)` proves that update behavior is already expected to flow through `engine.get(...)` plus `engine.save(...)`.

What this story likely changes:
- Add the missing task read and delete paths to `DemoApp`.
- Possibly add a broader bounded task-update helper if the CLI needs it, but keep `task done` as a valid small update path unless a better replacement is justified.

What must be preserved:
- SQLite-backed local storage setup.
- Existing sync methods and `pod` option handling.
- Journal-entry creation and validation against existing tasks.

Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:31)

#### `demo/cli.ts`

Current state:
- Help text advertises `task add`, `task list`, and `task done`, but no task delete or single-task read command.
- The CLI already follows a stable `resource + verb + options` grammar with consistent human-readable output.
- `task done` is the current update path; `journal` and `sync` commands already exist and should not be disturbed by task CRUD additions.

What this story likely changes:
- Add the missing task commands needed to make the local demo a complete CRUD walkthrough.
- Update help text and output expectations to match the implemented workflow.

What must be preserved:
- Current output style for success and error cases.
- Separation between CLI shell logic and demo application logic.
- Existing `journal` and `sync` command behavior.

Source: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:73)

#### `demo/README.md`

Current state:
- The documented first local run shows only add, list, and done.
- The README already frames the task flow as the repo's main local-first proof of value and explicitly says a Pod is not needed to start.

What this story likely changes:
- Expand the first-run section so a developer can see the full supported local CRUD loop from the docs alone.
- Keep the docs focused on the CLI workflow rather than pushing the user into internals.

What must be preserved:
- Local-only first-run framing.
- Clear separation between local CRUD and later sync steps.
- The repo's task-as-todo terminology decision from Story 1.2.

Source: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:39)

#### `tests/demo-cli.test.ts`

Current state:
- Covers task creation, task listing, task completion, journal commands, restart persistence, help output, and basic sync status/validation.
- Does not currently verify task deletion or any explicit single-task read command.

What this story likely changes:
- Add regression coverage for the missing task CRUD operations and any new CLI output.

What must be preserved:
- Persistence-across-restart regression.
- Existing journal and sync smoke tests.
- Behavior-first testing through the documented CLI path.

Source: [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:46)

### Architecture Compliance

- The public surface stays intentionally small: `defineVocabulary(...)`, `defineEntity<T>(...)`, `createEngine(...)`, CRUD methods, sync lifecycle, and adapter entrypoints. Story 1.3 should consume that surface, not expand or bypass it. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18)]
- Local writes must commit locally first and remote sync remains background work. This story is explicitly the pre-sync proof-of-value path, so do not entangle task CRUD with mandatory Pod configuration. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:75), [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:151)]
- Application-facing reads and lists are meant to come from the local read model, not Pod queries. Any new demo read command should keep that mental model obvious. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:118), [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:162)]
- The demo should remain a small regression harness and future TUI host, not a place to push framework logic into the engine core. [Source: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:13), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:112)]

### Previous Story Intelligence

- Story 1.2 deliberately established `TaskEntity` as the repo's reusable bounded todo example and warned against creating competing patterns or hiding the RDF contract.
- Story 1.2 also highlighted the naming guardrail: the planning docs say "todo", but the concrete CLI and entity kind stay `task`. Keep that consistent rather than introducing a half-rename in Story 1.3.
- The earlier review risk remains relevant here: the docs-visible workflow must match the real command behavior exactly.

Source: [1-2-define-a-todo-entity-through-the-local-public-api.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-2-define-a-todo-entity-through-the-local-public-api.md:1)

### Git Intelligence

Recent commits:
- `00a7745` `simplifying the demo entity`
- `55d97c7` `story 1.1`
- `ac3cd59` `planning the work with bmad-method`

Actionable takeaways:
- The latest repo change simplified the demo entity and added focused demo-entity coverage, so Story 1.3 should build on the current task shape instead of broadening it again.
- Story 1.1 and Story 1.2 both invested in the first-run path; Story 1.3 should keep one coherent onboarding path instead of splitting docs between multiple ways to prove local-first value.

Source: `git log --oneline -5`, `git show --stat --oneline --summary 00a7745`

### Testing Requirements

- Minimum expected checks remain `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` when the environment allows. [Source: [AGENTS.md](/media/michal/data/code/lofipod/AGENTS.md:1), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:43)]
- Prefer behavior-focused tests through the CLI or public demo API before reaching for implementation-coupled internals. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:11)]
- The core engine already has strong public API CRUD coverage, including delete semantics; use the demo tests to prove that the demo wiring exposes those behaviors correctly rather than re-testing engine internals in a second style. [Source: [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:771)]

### Latest Technical Information

- The repo pins `typescript` `^6.0.3`. TypeScript 6.0 is current and deprecates several legacy module-resolution and emit paths; keep any new demo or test code aligned with the repo's modern ESM and strict-TypeScript posture instead of introducing compatibility-era patterns. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- The repo pins `vitest` `^4.1.4`. Vitest 4 requires Node `>=20` and changed coverage remapping behavior; when adding tests, avoid deprecated older-Vitest idioms and keep the suite compatible with the repo's Node 24 baseline. Source: https://main.vitest.dev/guide/migration
- The repo itself requires Node `>=24`, and the Node project blog lists `24.15.0` as the latest 24.x LTS release as of April 15, 2026. Story work should therefore assume modern Node 24 behavior is an acceptable baseline for the demo and tests. Source: https://nodejs.org/en/blog
- The repo still depends on `n3` `^2.0.3`, while npm currently lists `1.26.0` as the latest published `n3` release. That mismatch is noteworthy but out of scope for this story; do not turn Story 1.3 into a dependency-upgrade detour. Source: https://www.npmjs.com/package/n3

### Implementation Strategy Notes

- The smallest coherent implementation is likely to keep `task add`, `task list`, and `task done`, then add the missing single-item read and delete commands rather than redesigning the whole task command set.
- If a broader task-update command is added, keep it bounded to existing task fields and make sure the output remains easy to scan in docs and tests.
- Preserve the current demo app layering: CLI parses arguments, app methods orchestrate the task workflow, and the engine owns actual CRUD and persistence semantics.
- Be explicit about deletion semantics for journal-linked tasks before implementation. At minimum, avoid silently corrupting journal behavior; if deletion does not cascade, tests and docs should reflect that truth clearly.

### Project Structure Notes

- Root public API boundary: [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- Node entrypoint used by the demo: [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)
- Demo entity definitions: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- Demo app orchestration: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- Demo command surface: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- Demo workflow docs: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

Detected variances and rationale:
- No separate UX artifact exists in `_bmad-output/planning-artifacts`, so the story uses the epics, PRD, project context, and live docs/demo code as the source of developer-experience guidance.
- The live repo already contains persistence behavior planned for Story 1.4. This story should preserve that implementation while staying scoped to exposing full local CRUD cleanly.

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
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [tests/demo-entities.test.ts](/media/michal/data/code/lofipod/tests/demo-entities.test.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:295)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [1-2-define-a-todo-entity-through-the-local-public-api.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-2-define-a-todo-entity-through-the-local-public-api.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Story target auto-discovered from `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-3-build-local-crud-for-the-in-repo-todo-demo`
- No separate UX artifact was present in `_bmad-output/planning-artifacts`
- Live repo analysis found that the demo already persists locally via SQLite and already has a restart regression, so Story 1.3 should preserve that behavior while closing the missing CRUD surface
- Live repo analysis found that the concrete task demo currently exposes create/list/update-via-done but lacks delete and explicit single-item read commands in the app and CLI layers
- Latest-technology spot checks were taken from official TypeScript, Vitest, and Node sources plus npm package metadata for `n3`
- Red phase started by extending `tests/demo-cli.test.ts` with explicit `task get` and `task delete` coverage, which failed against the existing CLI with `Unknown command.`
- `npx vitest run tests/demo-cli.test.ts` passed after implementing `getTask(...)`, `deleteTask(...)`, and the new CLI verbs.
- Validation summary:
  - `npm run build` -> passed
  - `npm test` -> passed (`8` files, `128` tests)
  - `npm run test:demo` -> passed
  - `npm run test:pod` -> passed (`6` files, `13` tests)
  - `npm run verify` -> failed at `prettier --check .` because of formatting drift in `_bmad-output/implementation-artifacts/1-2-define-a-todo-entity-through-the-local-public-api.md`, this story file, `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`, `docs/architecture.md`, `docs/project-overview.md`, `docs/project-scan-report.json`, and `tests/demo-pod.integration.test.ts`

### Completion Notes List

- Created the Story 1.3 implementation artifact with acceptance criteria, implementation tasks, architecture guardrails, codebase-specific touch points, and testing expectations.
- Recorded the current repo-state variance that local persistence is already implemented even though later planning still assigns it to Story 1.4.
- Set sprint tracking for Story 1.3 to `ready-for-dev`.
- Added explicit single-task read and delete operations to `DemoApp` while keeping the demo on the existing public engine and node entrypoints.
- Extended the CLI with `task get <id>` and `task delete <id>` and kept the existing `task add`, `task list`, `task done`, `journal`, and `sync` flows intact.
- Updated `demo/README.md` so the first local run now documents the full local CRUD loop without requiring Pod setup or source inspection.
- Added CLI regression coverage for the new read and delete commands and confirmed the broader demo, unit, and Pod-backed suites remain green.

### File List

- `_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `demo/README.md`
- `demo/app.ts`
- `demo/cli.ts`
- `tests/demo-cli.test.ts`

## Change Log

- 2026-05-02: Added explicit `task get` and `task delete` support to the demo app and CLI, documented the full local CRUD loop, and extended CLI regression coverage for the completed task flow.
