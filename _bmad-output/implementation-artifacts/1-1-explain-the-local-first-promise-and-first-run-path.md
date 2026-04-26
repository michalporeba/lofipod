# Story 1.1: Explain the Local-First Promise and First-Run Path

Status: done

## Story

As a developer evaluating lofipod,
I want a clear first-contact explanation and setup path,
so that I can understand what the library does and how to start without reading internals.

## Acceptance Criteria

1. Given a developer arrives at the `lofipod` repository for the first time, when they read the primary entry surface, then it explains the problem `lofipod` solves, the bounded app class it targets, and the local-first plus Pod-backed mental model in plain language, and it states clearly what is intentionally out of scope.
2. Given a developer wants to try `lofipod` without setting up Pod sync first, when they follow the first-run path in the repository documentation, then they are directed to a simple in-repo todo demo that proves local-first value before remote sync, and the path does not require reading internal source files to understand the workflow.
3. Given a developer is deciding how to start coding with `lofipod`, when they review the first-run documentation, then it shows the supported package entrypoints and distinguishes `lofipod`, `lofipod/browser`, and `lofipod/node` correctly, and it keeps the framework-agnostic core boundary clear.
4. Given a developer wants to know the minimum supported workflow, when they read the getting-started guidance, then it describes the sequence of defining an entity, creating an engine, performing local CRUD, and using the in-repo todo demo as the first proof of value, and it does not require Pod connection for this initial path.
5. Given a developer or LLM-assisted builder follows the documented first-contact path, when they complete the setup steps for the initial local-only experience, then they can identify the exact files, commands, and documented next step needed to run or inspect the todo demo, and the instructions are consistent with the actual repository layout and public API.

## Tasks / Subtasks

- [x] Align the first-contact repository narrative with the actual product scope and first-run promise (AC: 1, 4)
  - [x] Update `README.md` so the opening path clearly explains local-first plus Pod-backed sync, intended users, bounded scope, and out-of-scope items in plain language.
  - [x] Make the initial workflow explicit: define entity, create engine, local CRUD, then optional sync later.
  - [x] Keep the root package description framework-agnostic and avoid implying React or other framework bindings in core onboarding.
- [x] Establish a local-only first-run path that points to the in-repo demo before Pod sync (AC: 2, 4, 5)
  - [x] Update `README.md`, `docs/QUICKSTART.md`, and `demo/README.md` so a developer can reach a local-only demo path without reading source files.
  - [x] Use the existing task-oriented demo flow as the first proof of value; do not require Pod configuration for the first-run path.
  - [x] Document the exact commands and files a developer should inspect next for the demo workflow.
- [x] Document the supported public entrypoints accurately (AC: 3)
  - [x] Explain the distinction between `lofipod`, `lofipod/browser`, and `lofipod/node` consistently across the onboarding docs.
  - [x] Ensure the docs do not imply browser- or Node-specific adapters are available from the root entrypoint.
  - [x] Cross-check wording against the current public entrypoint tests before finalizing text.
- [x] Make the first-run path consistent with the current repo layout and existing demo behavior (AC: 2, 5)
  - [x] Verify all referenced files and commands exist in the current repository.
  - [x] Prefer pointing at `demo/README.md`, `demo/cli.ts`, and the task-oriented CLI flow rather than inventing a separate sample app.
  - [x] If “todo demo” wording does not exactly match current naming, reconcile the documentation carefully without expanding scope or rewriting the demo architecture.
- [x] Verify the onboarding path through existing workflow checks and targeted regression coverage (AC: 5)
  - [x] Run `npm run verify`.
  - [x] Run `npm run build`.
  - [x] Run `npm run test:demo`.
  - [x] If docs or examples require test updates, keep them behavior-focused and public-surface-oriented.

### Review Findings

- [x] [Review][Patch] README demo commands assume a fixed task ID that the CLI does not generate [README.md:123]

## Change Log

- 2026-04-26: Updated onboarding docs to make the local-only first-run path explicit, clarified root/browser/node entrypoint boundaries, and documented exact demo commands and files for the in-repo local proof of value.

## Dev Notes

- This story is primarily a documentation and onboarding slice, but it must stay grounded in the existing library and demo behavior rather than aspirational wording.
- The accepted architecture requires a framework-agnostic core package and separate browser/Node entrypoints. Do not blur that boundary in onboarding copy.
- The public API direction already defines the minimal local-first path: define vocabulary, define entity, create engine, save/get/list/delete locally, then add persistence or sync later.
- The current in-repo demo is CLI-first and currently covers tasks and journal entries. For this story, the local-first task flow is the relevant first proof of value.
- Pod sync is intentionally later in the journey. The first-run path must remain useful without `createSolidPodAdapter(...)`, Pod credentials, or server setup.

### Project Structure Notes

- Likely primary files:
  - `README.md`
  - `docs/QUICKSTART.md`
  - `demo/README.md`
- Likely verification anchors:
  - `tests/entrypoints.test.ts`
  - `tests/demo-cli.test.ts`
- Avoid changing:
  - core engine behavior
  - package export boundaries
  - Pod sync architecture
- If the current docs index needs adjustment so the first-run path is easier to find, keep that change minimal and consistent with the existing docs structure.

### Developer Context

#### Relevant Existing Behavior

- `README.md` already explains the product, entrypoints, and status, but the first-run path should be tightened around a concrete local-only proof before sync.
- `docs/QUICKSTART.md` already demonstrates a local-only `Task` example through the root `lofipod` entrypoint and `createMemoryStorage()`.
- `demo/README.md` describes a CLI-first demo with task and journal entities and local SQLite-backed persistence.
- `tests/entrypoints.test.ts` is the executable contract for which APIs belong to the core, browser, and node entrypoints.
- `tests/demo-cli.test.ts` is the regression harness for the local demo task and journal flows and should remain consistent with the onboarding path.

#### Technical Requirements

- Keep all documentation aligned with the current public API names and entrypoints.
- Do not instruct users to import browser-only or Node-only adapters from the root `lofipod` package.
- Do not require reading internal modules under `src/` as part of the first-run path.
- Do not introduce a Pod-first or sync-first onboarding sequence for this story.
- Keep terminology consistent:
  - local-first first
  - Pod-backed sync second
  - canonical Pod RDF as the remote durability model
- If commands are documented, they must match existing repo scripts and demo capabilities.

#### Testing Requirements

- Treat `npm run verify`, `npm run build`, and `npm run test:demo` as the minimum expected checks for this story.
- If any example snippets are changed materially, verify they still reflect the current API surface in `docs/API.md` and `docs/QUICKSTART.md`.
- Prefer targeted test additions only if they protect a user-visible contract that could regress; avoid adding brittle tests for prose wording alone.

#### Architecture Compliance

- Preserve the framework-agnostic core boundary. This is an accepted architectural constraint, not just a documentation preference.
- Keep the onboarding path local-first and application-facing; the Pod remains a backing store and sync target, not the primary read/query engine.
- Keep the project scoped as a minimal local-first SOLID Pod sync library, not a general sync framework, UI framework, or RDF database.

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [tests/entrypoints.test.ts](/media/michal/data/code/lofipod/tests/entrypoints.test.ts:1)
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [\_bmad-output/planning-artifacts/prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [\_bmad-output/planning-artifacts/epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:222)
- [\_bmad-output/project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- No `sprint-status.yaml` existed, so the story target was derived directly from `_bmad-output/planning-artifacts/epics.md`.
- Validation commands run:
  - `npm run verify` -> failed at `prettier --check .` because of pre-existing formatting drift in unrelated files: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`, `docs/architecture.md`, `docs/project-overview.md`, and `docs/project-scan-report.json`
  - `npx prettier --check README.md docs/QUICKSTART.md demo/README.md _bmad-output/implementation-artifacts/1-1-explain-the-local-first-promise-and-first-run-path.md` -> passed
  - `npm run lint` -> passed
  - `npm run check` -> passed
  - `npm test` -> passed (`7` files, `125` tests)
  - `npm run build` -> passed
  - `npm run test:demo` -> passed
  - `npm run test:pod` -> passed (`6` files, `13` tests)

### Completion Notes List

- Updated `README.md` with an explicit local-only first-run path, exact demo commands, and a clearer explanation of the core versus browser/node entrypoints.
- Updated `docs/QUICKSTART.md` to keep the initial example rooted in the core package and point directly to the in-repo demo as the next local-first step.
- Updated `demo/README.md` with exact local demo commands, optional isolated data-dir usage, and the key files to inspect without reading internals.
- Verified the onboarding changes against the existing public entrypoint and demo behavior contracts.
- Confirmed `lint`, `check`, `test`, `build`, `test:demo`, and `test:pod` pass. `verify` remains blocked by pre-existing formatting drift in unrelated generated/project docs outside this story's write scope.

### File List

- `README.md`
- `docs/QUICKSTART.md`
- `demo/README.md`
- `_bmad-output/implementation-artifacts/1-1-explain-the-local-first-promise-and-first-run-path.md`
