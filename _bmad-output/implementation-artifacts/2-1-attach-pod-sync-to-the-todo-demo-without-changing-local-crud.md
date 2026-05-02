# Story 2.1: Attach Pod Sync to the Todo Demo Without Changing Local CRUD

Status: review

## Story

As a developer extending the in-repo todo demo,
I want to attach Pod-backed sync to the existing local-first app,
so that remote durability is additive rather than a rewrite.

## Acceptance Criteria

1. Given the in-repo todo demo already works locally without Pod sync, when a developer enables sync for the demo through the supported configuration path, then the same local CRUD workflow continues to work through the public API, and the developer is not required to redesign the app around remote-first concepts.
2. Given a developer wants to add Pod-backed behavior to the existing demo, when they follow the documented sync-attachment path, then the setup makes clear which configuration belongs to the core engine and which runtime-specific adapter belongs to the browser or Node entrypoint, and the framework-agnostic boundary of the root package remains intact.
3. Given sync is attached to the todo demo, when a local save or delete operation completes, then the local operation succeeds on the local-first path before remote synchronization work is attempted, and sync is treated as background behavior rather than a prerequisite for CRUD success.
4. Given a developer is evaluating whether sync is additive or invasive, when they compare the local-only demo flow with the sync-enabled flow, then the application-facing programming model remains substantially the same, and the new sync behavior is introduced as an attachment rather than a replacement for the local workflow.
5. Given a developer or LLM-assisted builder is using the demo as the reference path, when they inspect the sync-enabled setup, then they can identify the minimum supported pattern for attaching Pod sync to an existing local-first app, and the example is small enough to support the later sync stories without hidden glue code.

## Tasks / Subtasks

- [x] Refactor the demo app to demonstrate additive runtime sync attachment instead of only constructor-time sync configuration (AC: 1, 3, 4, 5)
  - [x] Keep `createDemoApp(...)` local-first by default: entity registration, SQLite storage, and CRUD behavior must still work with no Pod inputs at all.
  - [x] Add a small explicit demo-layer attachment path that calls `engine.sync.attach(...)` with a Node-side Solid adapter and Pod config when sync commands need it.
  - [x] If constructor-time Pod options remain for internal convenience, do not let that remain the primary reference pattern; the externally visible demo flow should show attachment as an additive step.
  - [x] Preserve the invariant that task/journal CRUD methods succeed locally before any remote work is attempted.
- [x] Keep the CLI and demo surface small while making sync attachment explicit (AC: 1, 2, 4, 5)
  - [x] Update `demo/cli.ts` so the sync-related commands use the supported attachment path and do not force the normal task/journal commands to become remote-first.
  - [x] Ensure the sync command path shows the minimum needed runtime inputs: Pod base URL, optional log path override, and any Node-side authorization/fetch integration the demo supports.
  - [x] Keep command grammar and output style stable unless a concrete mismatch with the story goals requires a change.
- [x] Document the boundary between core config and runtime-specific adapter wiring (AC: 2, 4, 5)
  - [x] Show in docs and code comments that `createEngine(...)` remains framework-agnostic and environment-neutral at the root package boundary.
  - [x] Keep `createSolidPodAdapter(...)` and `createSqliteStorage(...)` on the Node entrypoint path (`lofipod/node`), not the root `lofipod` entrypoint.
  - [x] Explain that persisted Pod config may survive restart, but a live adapter still has to be supplied at runtime before sync can actually run.
- [x] Add or adjust behavior-focused regression coverage around additive attach semantics (AC: 1, 3, 4, 5)
  - [x] Extend `tests/demo-cli.test.ts` for the local-first demo guarantees that must remain unchanged after the sync path is introduced.
  - [x] Extend `tests/demo-pod.integration.test.ts` or adjacent Pod-backed demo tests so they prove the demo can attach sync, push pending local changes, and keep local CRUD working.
  - [x] Reuse existing public-API sync semantics already proven in `tests/public-api.test.ts`; do not duplicate deep engine behavior in demo tests unless the demo layer itself adds risk.
- [x] Update demo-facing documentation so the sync-enabled path is trustworthy and minimal (AC: 2, 4, 5)
  - [x] Update `demo/README.md` to show the local-only path first and the sync-attachment path second.
  - [x] Make the narrative explicit that Pod sync is an attachment to the same app, not a different app architecture.
  - [x] Keep the demo small enough that later stories can layer canonical mapping, bootstrap, offline recovery, and multi-device behavior without backtracking over hidden setup.

## Dev Notes

### Story Intent

Story 2.1 is the bridge from Epic 1's proven local-only demo into Epic 2's additive sync model. The implementation should not invent a new demo or a remote-first branch of the app. It should show that the same SQLite-backed demo can stay local-first and then attach Pod sync through the public sync lifecycle. Sources: `_bmad-output/planning-artifacts/epics.md` Epic 2 / Story 2.1, `docs/API.md` "Adding persistence and sync", `docs/ADR.md` "Synchronisation", `docs/architecture.md` "Local Engine Layer".

### Critical Guardrails

- Keep the root package environment-neutral. Do not move Solid-specific or SQLite-specific concerns into `src/index.ts` or other root-core exports. Use `lofipod/node` for the demo's sync and storage wiring. Sources: `README.md` "Current entrypoints", `docs/ADR.md` "Language and packaging", `docs/architecture.md` "Public API Design", `src/node.ts`.
- Do not redesign CRUD around remote availability. `engine.save(...)` and `engine.delete(...)` already commit locally first and only then queue background sync. The demo must preserve that behavior and make it more visible, not less. Sources: `src/engine.ts`, `docs/ADR.md` "Synchronisation", `docs/WIP.md` "Loading and sync flow".
- Prefer runtime `engine.sync.attach(...)` as the reference pattern for this story. The public API, tests, and architecture all frame sync as attachable at runtime; the demo should align with that instead of relying solely on passing sync config at engine creation. Sources: `docs/API.md` "You can also attach sync later", `src/types.ts` `SyncAttachConfig`, `tests/public-api.test.ts` attach-focused cases.
- Persisted Pod config is not a substitute for a live adapter. The engine stores `podBaseUrl` and `logBasePath`, but the application still has to provide a runtime adapter after restart. The demo must not imply that persisted config alone can perform authenticated remote work. Sources: `docs/ADR.md` "Persisted Pod connection metadata may survive restart...", `src/engine.ts` `sync.attach(...)`, `src/types.ts` `PersistedPodConfig`.
- Keep Story 2.1 scoped to additive attach semantics. Do not turn this story into canonical mapping redesign, bootstrap import UX, multi-device reconciliation, or offline recovery policy work. Those are later Epic 2 and Epic 3 slices. Sources: `_bmad-output/planning-artifacts/epics.md` Stories 2.2-2.7.

### Current Codebase State

#### `demo/app.ts`

Current state:

- `createDemoApp(...)` already builds the demo with `createEngine(...)`, demo entities, and SQLite storage.
- When `options.pod` is supplied, it currently passes both `pod` config and `sync.adapter` directly into engine creation.
- The demo API exposes `syncState()`, `syncNow()`, and `syncBootstrap()`, but no explicit demo-layer `attachPodSync(...)` helper yet.

What this story should change:

- Introduce or prefer a small explicit attachment step at the demo layer that uses `engine.sync.attach(...)`.
- Keep CRUD helpers unchanged or nearly unchanged so the demo remains the same app with an added sync capability.
- Make it obvious where local-first app wiring ends and runtime-specific sync wiring begins.

What must be preserved:

- SQLite-backed restart-safe local state in `state.sqlite`.
- The existing task and journal demo API shape unless a small sync-oriented addition is needed.
- No React or browser assumptions in shared core code.

Source: `demo/app.ts`

#### `demo/cli.ts`

Current state:

- The CLI constructs `createDemoApp(...)` up front for every command.
- If `--pod-base-url` or `LIFEGRAPH_DEMO_POD_BASE_URL` is present, the CLI currently creates the app with Pod config immediately rather than attaching later.
- Sync commands already exist: `sync status`, `sync bootstrap`, and `sync now`.

What this story should change:

- Route sync-capable commands through an explicit attachment path instead of relying on the engine being preconfigured during construction.
- Keep task and journal commands local-first and simple.
- Avoid hidden glue where a local CRUD command silently changes its operating model just because a Pod env var exists.

What must be preserved:

- Existing command naming and thin-CLI architecture.
- Friendly output that remains suitable for docs and smoke tests.
- One CLI process per command with reopen-safe state.

Source: `demo/cli.ts`

#### `src/engine.ts`

Current state:

- The engine already supports local writes first, queued background sync, runtime `sync.attach(...)`, `sync.detach()`, `sync.now()`, and `sync.bootstrap()`.
- `sync.attach(...)` persists Pod config, starts notifications/polling, and immediately queues a background sync cycle.
- Startup-time sync configuration is also supported when `config.sync` and `config.pod` are present.

What this story changes:

- Likely no core behavior change should be necessary unless the demo reveals a real mismatch.
- The main role of this file in Story 2.1 is as a contract the demo must follow.

What must be preserved:

- Local commit before remote work.
- Automatic push of pending local changes after attach.
- Explicit runtime attach/detach semantics and persisted config behavior.

Source: `src/engine.ts`

#### `src/types.ts`

Current state:

- The public API already codifies `sync.attach(config)`, `sync.detach()`, `sync.state()`, `sync.now()`, and `sync.bootstrap()`.
- `SyncAttachConfig` requires both a runtime adapter and Pod config.
- `PersistedPodConfig` stores only `podBaseUrl` and `logBasePath`.

Why this matters here:

- The story should reuse this public contract rather than inventing a demo-only alternative concept of "sync enabled".
- The difference between persisted config and a live adapter should be reflected in the demo docs and tests.

Source: `src/types.ts`

#### `tests/public-api.test.ts`

Current state:

- Public API coverage already proves that attach can push pending local changes automatically, that detach leaves later changes local-only, and that attach can be re-run with different adapters/config.
- There is already explicit regression coverage that attach triggers background pull work and persists Pod config.

What this story should do with that:

- Lean on these tests as the engine-level truth.
- Only add demo-layer tests for the wiring and user-facing behavior that public API tests do not already cover.

Sources: `tests/public-api.test.ts` attach-related cases around the `sync.attach(...)` suite.

#### `tests/demo-pod.integration.test.ts`

Current state:

- The demo already has a Community Solid Server integration suite.
- It proves a CLI-driven Pod sync flow, including `sync status`, `sync now`, and `sync bootstrap`.
- The current flow uses the existing demo wiring, which may already be ahead of the story in capability but not aligned with the intended additive attach narrative.

What this story should change:

- Keep this suite focused on demo-layer behavior and the supported attachment workflow.
- Update assertions as needed to reflect explicit attach semantics instead of implicit startup-time remote configuration.

What must be preserved:

- Real Pod-backed end-to-end confidence.
- Small focused scope suitable for `npm run test:pod`.

Source: `tests/demo-pod.integration.test.ts`

#### `demo/README.md`

Current state:

- The local-only first-proof path is already documented clearly.
- The sync section is brief and currently lists commands more than it explains the additive attachment model.

What this story should change:

- Add a short "attach sync to the same app" explanation.
- Clarify the minimum supported Node-side sync inputs and the fact that local CRUD remains the same.
- Avoid overpromising about canonical mapping or multi-device consistency before the later Epic 2 stories land.

Source: `demo/README.md`

### Reinvention And Regression Risks

- Do not introduce a parallel demo app or second entity model just to show sync. Reuse `demo/entities.ts`, `demo/app.ts`, and the existing CLI.
- Do not move authentication or Pod session ownership into the root API surface.
- Do not make `task add`, `task done`, or `task delete` depend on a successful remote round-trip.
- Do not hide runtime attach details behind undocumented magic env behavior that later stories cannot reason about.
- Do not over-test engine internals in demo tests when the public API suite already proves them.

### Implementation Strategy Notes

- The cleanest shape is likely:
  - build the demo app locally first
  - for sync commands, create a Node-side Solid adapter
  - call `engine.sync.attach(...)` with `podBaseUrl`, `logBasePath`, and optional auth/fetch inputs
  - then call `sync.state()`, `sync.now()`, or `sync.bootstrap()`
- If the demo needs to reconnect sync on each CLI process, that is acceptable and consistent with the architecture. Each CLI command already reopens the same local SQLite state.
- Prefer a very small demo-owned helper over pushing attachment convenience into the engine if the engine already exposes the right contract.
- Document one minimum supported pattern clearly enough that later stories can extend it for ontology mapping, bootstrap import, offline recovery, and multi-device checks.

### Testing Requirements

- Expected local verification for substantive implementation remains:
  - `npm run verify`
  - `npm run build`
  - `npm run test:demo`
  - `npm run test:pod`
- Prioritize behavior-focused checks through the public API and demo CLI.
- For this story, the most valuable regressions are:
  - local CRUD still works unchanged with no Pod setup
  - attach can push already-pending local changes
  - sync commands clearly use the supported attachment path
  - docs and CLI behavior stay aligned

Sources: `AGENTS.md`, `docs/TESTING.md`, `docs/development-guide.md`

### Latest Technical Information

- TypeScript `6.0` is the repo's current configured major (`^6.0.3`). The official TypeScript 6.0 release notes emphasize newer defaults and deprecations around legacy module-resolution and output targets; keep touched code and docs aligned with this repo's existing strict ESM posture instead of introducing legacy guidance.
  Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest `4` requires Node `>=20`; this repo targets Node `>=24`, so test additions should stay on current Vitest idioms and not reintroduce older migration-era patterns.
  Source: https://main.vitest.dev/guide/migration
- Official Node 24 LTS release posts confirm the repo's Node 24 baseline is current and supported; demo and test guidance should continue to assume modern Node 24 behavior.
  Source: https://nodejs.org/en/blog/release/v24.11.0
- Inrupt's current Node authentication docs still center `@inrupt/solid-client-authn-node` around a `Session` whose authenticated `fetch` performs Pod requests. If Story 2.1 mentions authenticated Pod access, keep that as Node runtime wiring passed into the adapter, not as a core-engine concern.
  Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Project Structure Notes

- Demo entity and RDF mapping: `demo/entities.ts`
- Demo app orchestration: `demo/app.ts`
- Demo CLI shell: `demo/cli.ts`
- Demo docs: `demo/README.md`
- Node entrypoint boundary: `src/node.ts`
- Engine sync lifecycle: `src/engine.ts`
- Public API contracts: `src/types.ts`, `docs/API.md`
- Epic/story source: `_bmad-output/planning-artifacts/epics.md`
- Pod-backed demo integration tests: `tests/demo-pod.integration.test.ts`
- Public API sync semantics: `tests/public-api.test.ts`

Detected variances and rationale:

- There is no dedicated UX artifact under `_bmad-output/planning-artifacts`; UX guidance for this story comes from the PRD, epic wording, and existing docs.
- The repo already contains Pod sync capabilities in the demo layer. Story 2.1 should therefore focus on making the attachment pattern explicit and trustworthy, not on pretending sync is entirely absent.
- The demo integration suite is already exercising Pod sync. Treat that as evidence the story may be partly prefigured in code; implementation should align the example path with the accepted public API story instead of duplicating capability.

### References

- `README.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `docs/architecture.md`
- `docs/QUICKSTART.md`
- `docs/TESTING.md`
- `docs/development-guide.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`
- `demo/README.md`
- `demo/app.ts`
- `demo/cli.ts`
- `demo/entities.ts`
- `src/engine.ts`
- `src/node.ts`
- `src/types.ts`
- `tests/demo-cli.test.ts`
- `tests/demo-pod.integration.test.ts`
- `tests/public-api.test.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /media/michal/data/code/lofipod/_bmad/scripts/resolve_customization.py --skill /media/michal/data/code/lofipod/.agents/skills/bmad-dev-story --key workflow`
- `npx vitest run tests/demo-cli.test.ts tests/demo-pod.integration.test.ts`
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`
- Source and artifact reads listed in workflow analysis

### Completion Notes List

- Added explicit `attachPodSync(...)` wiring to the demo app so `createDemoApp(...)` stays local-first by default and sync is attached only when requested.
- Updated the CLI so only `sync ...` commands attach the Node-side Solid adapter; task and journal commands stay local-first even when Pod env vars are present.
- Documented the additive attach model in `demo/README.md`, including the core/runtime boundary and the need for a live adapter on each process.
- Added regression coverage for local CRUD staying local with Pod env vars present, explicit sync configuration state before attach, and the sync-status transition from local-only to attached Pod sync.
- Validation completed successfully with `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- `_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `demo/README.md`
- `demo/app.ts`
- `demo/cli.ts`
- `tests/demo-cli.test.ts`
- `tests/demo-pod.integration.test.ts`
