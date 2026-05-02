# Story 1.4: Persist the Todo Demo Across Restart

Status: review

## Story

As a developer testing real local-first behavior,
I want the demo todo app's local state to survive restart,
so that the first demonstration reflects real day-to-day use rather than an in-memory toy.

## Acceptance Criteria

1. Given a developer has created one or more todo items through the in-repo demo, when they stop and restart the demo using the documented local persistence path, then the previously stored todo items are still available, and the restored data can be read and listed through the same documented workflow.
2. Given the demo is intended as the first real proof of local-first usefulness, when local persistence is configured for the demo, then it uses a supported storage approach appropriate to the runtime being demonstrated, and it does not require any remote service or Pod connection to preserve state.
3. Given a developer updates or deletes todo items before restarting the demo, when the application is started again, then the post-restart state reflects the latest successful local operations, and the persisted result is consistent with the local-first API behavior already demonstrated in earlier stories.
4. Given a developer is trying to understand what "local-first" means in practice, when they review the demo and its supporting guidance, then they can see clearly that local durability is part of the supported workflow, and the persistence setup remains small enough to understand without reading internal implementation details.
5. Given the todo demo is used as an in-repo validation harness, when the persistence story is complete, then the repository contains a repeatable way to demonstrate restart-safe local state for the simple todo app, and that proof remains aligned with the documented public API.

## Tasks / Subtasks

- [x] Tighten the restart-safe proof instead of re-implementing persistence from scratch (AC: 1, 2, 5)
  - [x] Keep the existing SQLite-backed demo storage path in `demo/app.ts` as the supported Node runtime persistence mechanism unless a defect requires a surgical fix.
  - [x] Verify that the restart workflow remains expressible through the documented demo path rather than only through direct app or storage internals.
  - [x] Do not turn this story into a new storage-abstraction design, browser persistence story, or sync story.
- [x] Expand restart coverage to prove post-restart read/list behavior for latest local state, not only first-save recovery (AC: 1, 3, 5)
  - [x] Extend `tests/demo-cli.test.ts` so restart-safe behavior covers at least one update path (`task done`) and one delete path across app recreation, not just add-then-list.
  - [x] Prefer behavior checks through `createDemoApp(...)` and/or the CLI workflow that mirror the documented user path.
  - [x] Preserve the existing no-Pod local-first expectations while exercising restart semantics.
- [x] Make the persistence path obvious in the docs and help surface (AC: 1, 2, 4)
  - [x] Update `demo/README.md` so it explicitly explains where local state lives by default, how `--data-dir` changes that location, and how to demonstrate restart-safe state with the same directory.
  - [x] Keep the restart explanation small and concrete; the reader should not need to inspect `src/storage/sqlite.ts` to understand the workflow.
  - [x] Keep the first-run path local-only and clearly separate from later Pod sync commands.
- [x] Preserve earlier CRUD guarantees while proving persistence (AC: 1, 3, 5)
  - [x] Treat Story 1.3's task CRUD flow as the baseline and confirm persistence work does not regress `task get`, `task list`, `task done`, `task delete`, journal commands, or sync commands.
  - [x] If a persistence bug requires changes outside the demo layer, keep them minimal and covered by behavior-focused tests through supported entrypoints.

## Dev Notes

### Story Intent

This story is now mostly a proof-hardening and documentation story, not a greenfield persistence implementation. The live repo already stores demo state in SQLite under the demo data directory and already has one restart regression. The remaining gap is that Story 1.4's acceptance criteria are broader than the current proof: the repo should demonstrate restart-safe persistence after update and delete operations, and the docs should make the persistence path explicit enough to follow without reading internals.

Sources: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:325), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

### Critical Guardrails

- Keep the root package framework-agnostic and environment-neutral. Demo persistence work belongs in `demo/` and existing Node adapter paths, not in the core entrypoint or any UI framework binding. Sources: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1), [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- Stay on supported public/demo entrypoints. The demo should continue to depend on `createEngine(...)` plus `createSqliteStorage(...)` from `../src/node.js`, not on deep internal imports added just for restart testing. Sources: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1), [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1), [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- Do not pull Pod sync into the local durability proof. Story 1.4 is explicitly about preserving local state without requiring any remote service or Pod connection. Sources: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:325), [README.md](/media/michal/data/code/lofipod/README.md:1), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- Avoid duplicating storage work already implemented. The SQLite adapter and demo wiring are present; if defects appear, fix the actual bug, but do not redesign the adapter contract or add a second persistence mechanism just to satisfy this story title. Sources: [src/storage/sqlite.ts](/media/michal/data/code/lofipod/src/storage/sqlite.ts:1), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1), [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- Preserve Story 1.3's completed CRUD and journal flow. Deletion and restart checks must not silently break journal commands, CLI help text, or task command semantics. Sources: [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1), [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)

### Current Codebase State

#### `demo/app.ts`

Current state:

- `createDemoApp(...)` already persists local demo state with `createSqliteStorage({ filePath: join(dataDir, "state.sqlite") })`.
- The task API now covers add/get/list/complete/delete, and journal flows validate referenced task IDs before saving.
- Recreating the demo app with the same `dataDir` should therefore be the natural restart proof path.

What this story likely changes:

- Little or no production code if the current persistence implementation is already correct.
- Possible small fixes if restart behavior after update/delete reveals a bug in demo orchestration or persistence wiring.

What must be preserved:

- Existing `dataDir` behavior and default cache-directory resolution.
- Optional Pod configuration and sync methods.
- Separation between CLI argument parsing and app-level operations.

Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)

#### `tests/demo-cli.test.ts`

Current state:

- The suite already proves CLI CRUD behavior and includes one restart regression for add-then-recreate.
- It does not yet prove that the latest local state after `task done` or `task delete` survives restart.

What this story likely changes:

- Add restart-focused tests covering update and delete outcomes across app recreation.
- Keep the assertions behavior-first and aligned with the documented demo workflow.

What must be preserved:

- Existing CLI coverage for create/get/list/done/delete.
- Journal and sync smoke coverage.
- Temporary-directory isolation and cleanup patterns already used in the suite.

Source: [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)

#### `demo/README.md`

Current state:

- The README already states that local-first state lives in a SQLite-backed filesystem store and shows the default cache-directory locations.
- It demonstrates CRUD commands and an optional `--data-dir` path, but it does not yet explicitly frame restart-safe persistence as the proof this story owns.

What this story likely changes:

- Make the restart proof explicit: use the same `--data-dir`, stop/start the demo, and confirm the same items remain available.
- Keep the explanation short, local-only, and easy to inspect.

What must be preserved:

- The "Pod not required to start" framing.
- The task-first proof-of-value path.
- The separation between local CRUD guidance and later sync guidance.

Source: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

#### `src/storage/sqlite.ts`

Current state:

- The SQLite adapter creates parent directories, initializes schema, runs transactions synchronously, and stores entity projections, graph state, change history, and sync metadata.
- Nothing in Story 1.4 requires redesigning this adapter; its main relevance is as the implementation already backing the demo.

What this story likely changes:

- Ideally nothing.
- Only touch this file if restart tests expose a real persistence defect.

What must be preserved:

- Existing schema and transaction behavior.
- Supported Node-local persistence semantics for the demo.

Source: [src/storage/sqlite.ts](/media/michal/data/code/lofipod/src/storage/sqlite.ts:1)

### Architecture Compliance

- The public surface stays intentionally small and explicit. Story 1.4 should prove local durability using that surface, not create a new persistence-facing API. Sources: [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- Local writes commit locally first, and remote sync is background work layered on top. The restart-safe proof should therefore remain valid without any sync configuration. Sources: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1), [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- The demo is both a first-use example and a regression harness. Keep the persistence proof understandable for developers while also making it repeatable in automated tests. Sources: [README.md](/media/michal/data/code/lofipod/README.md:1), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

### Previous Story Intelligence

- Story 1.3 already completed the task CRUD surface and explicitly recorded that local persistence had landed early relative to the original plan. Story 1.4 should build on that reality instead of pretending the repo is still at an in-memory-only stage.
- Story 1.3 also established that the demo's local-first proof should remain small, documented, and framework-agnostic. Reuse that shape rather than inventing a second first-run path.
- The main unfinished gap from Story 1.3, relative to Story 1.4's acceptance criteria, is breadth of restart validation rather than missing CRUD features.

Source: [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1)

### Git Intelligence

Recent commits:

- `8aa3aee` `crud in demo`
- `00a7745` `simplifying the demo entity`
- `55d97c7` `story 1.1`

Actionable takeaways:

- `8aa3aee` already touched the exact Story 1.4 surface: `demo/app.ts`, `demo/cli.ts`, `demo/README.md`, `tests/demo-cli.test.ts`, and the story artifacts. That commit is the immediate baseline to preserve and extend.
- `00a7745` simplified the demo entity and updated docs/tests, reinforcing that the demo should stay narrow and easy to explain rather than accumulating complexity during persistence work.
- The repo history supports a pragmatic interpretation of Story 1.4: tighten proof and docs around the existing SQLite-backed path instead of reopening entity-design or API-surface questions.

Sources: `git log --oneline -5`, `git show --stat --oneline 8aa3aee`, `git show --stat --oneline 00a7745`

### Testing Requirements

- Minimum expected checks for substantive changes remain `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` when the environment allows.
- Prefer behavior-focused tests through the documented demo path or public entrypoints before testing internal storage mechanics directly.
- For this story specifically, the highest-value regression is restart persistence after update/delete operations, because add-then-restart is already covered.

Sources: [AGENTS.md](/media/michal/data/code/lofipod/AGENTS.md:1), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)

### Latest Technical Information

- TypeScript 6.0 is the current repo-aligned major, and its release notes emphasize modern module-resolution defaults and deprecations of older compatibility paths. Keep any touched demo or test code aligned with the repo's current ESM and strict-TypeScript posture rather than reintroducing legacy patterns. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest 4 requires Node 20+ and changed V8 coverage remapping behavior. Any added restart tests should use current Vitest idioms and avoid older deprecated patterns. Source: https://main.vitest.dev/guide/migration
- Node's official blog lists Node `24.15.0` as the latest 24.x LTS release published on April 15, 2026. The repo's `package.json` still targets `>=24`, so assuming modern Node 24 behavior for demo persistence and test execution is consistent with current platform guidance. Source: https://nodejs.org/en/blog

### Implementation Strategy Notes

- Start by extending restart tests before changing production code. This story may already be satisfied by broadening proof and docs rather than altering persistence logic.
- Use the existing demo app recreation pattern in `tests/demo-cli.test.ts` as the base for restart assertions after `task done` and `task delete`.
- If the docs need one concrete persistence walkthrough, prefer an isolated `--data-dir /tmp/...` example because it makes restart validation and local inspection explicit without requiring the default cache path.
- If a defect appears in delete-after-restart behavior, inspect journal/task interactions carefully before changing semantics. Do not silently introduce cascade behavior or orphan-handling policy unless the acceptance criteria require it.

### Project Structure Notes

- Root public API boundary: [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- Node entrypoint used by the demo: [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)
- Demo app orchestration: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- Demo command surface: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- Demo workflow docs: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- Node-local persistence implementation: [src/storage/sqlite.ts](/media/michal/data/code/lofipod/src/storage/sqlite.ts:1)
- Demo regression harness: [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)

Detected variances and rationale:

- Story 1.4's core persistence capability already exists in the live repo, so this story should be executed as proof-hardening plus doc alignment, not as a brand-new storage implementation.
- No separate UX artifact exists in `_bmad-output/planning-artifacts`, so developer-experience guidance comes from the epics, PRD, project context, and live demo/docs files.

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)
- [src/storage/sqlite.ts](/media/michal/data/code/lofipod/src/storage/sqlite.ts:1)
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:325)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Story target auto-discovered from `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-4-persist-the-todo-demo-across-restart`
- Discovery results:
  - loaded epics from `_bmad-output/planning-artifacts/epics.md`
  - loaded PRD from `_bmad-output/planning-artifacts/prd.md`
  - no separate UX artifact found under `_bmad-output/planning-artifacts`
  - loaded persistent project facts from `_bmad-output/project-context.md`
- Live repo analysis confirmed that SQLite-backed local persistence and one restart regression already exist before Story 1.4 implementation begins.
- Story scope therefore shifts from "introduce persistence" to "prove and document restart-safe persistence comprehensively enough to satisfy Story 1.4 acceptance criteria."
- Latest-technology spot checks used official TypeScript, Vitest, and Node sources to confirm the current baseline remains compatible with the story guidance.
- Added restart regression coverage for completed-task and deleted-task outcomes across app recreation with the same `dataDir`.
- Confirmed the existing SQLite-backed demo path already satisfies the new restart cases without production persistence changes.
- Updated the demo README and CLI help text so the persisted SQLite path and same-directory restart workflow are visible from the supported demo surface.
- Validation results:
  - `npx vitest run tests/demo-cli.test.ts` passed
  - `npm run build` passed
  - `npm run test:demo` passed
  - `npm run test:pod` passed
  - `npm run lint` passed
  - `npm run check` passed
  - `npm test` passed
  - `npm run verify` did not complete because `prettier --check` reported pre-existing formatting drift in repository files outside this story's implementation scope, including BMAD artifacts and docs.

### Completion Notes List

- Created the Story 1.4 implementation artifact with acceptance criteria, implementation tasks, architecture guardrails, repo-specific touch points, and testing expectations.
- Recorded the live-repo variance that local persistence already exists, so Story 1.4 should focus on proof breadth and documentation alignment rather than a second persistence implementation.
- Captured the specific residual gap: restart coverage should prove update/delete durability, not only add-then-recreate behavior.
- Added restart persistence regression tests for `task done` and `task delete` across app recreation and confirmed they pass against the existing SQLite-backed demo path.
- Updated the demo README with a concrete same-`--data-dir` restart walkthrough and clarified that `state.sqlite` under the chosen data directory is the persisted local store.
- Added a short CLI help note that `--data-dir` selects the persisted SQLite-backed local state location.
- Re-ran the main validation gates and confirmed build, demo regression, Pod integration regression, lint, typecheck, and default tests pass.
- `npm run verify` remains blocked by pre-existing repository formatting drift outside the scope of this story.

### File List

- `demo/README.md`
- `demo/cli.ts`
- `tests/demo-cli.test.ts`
- `_bmad-output/implementation-artifacts/1-4-persist-the-todo-demo-across-restart.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-02: Added restart persistence coverage for completed and deleted tasks, clarified the persisted demo data path in docs/help, and moved Story 1.4 to review.
