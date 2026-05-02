# Story 1.5: Verify and Document the Todo Demo as the First Proof of Value

Status: review

## Story

As a developer deciding whether to adopt lofipod,
I want a tested, documented todo demo in the repository,
so that I can run it, inspect local state, and confirm the claimed developer workflow actually works.

## Acceptance Criteria

1. Given the in-repo todo demo supports local entity definition, CRUD, and restart-safe persistence, when a developer follows the documented demo workflow, then they can run the demo successfully as the primary first proof of value for lofipod, and the documented steps match the actual repository behavior.
2. Given the todo demo is meant to validate the early product promise, when the repository test and demo strategy is reviewed, then there is an explicit, repeatable way to verify the demo behavior, and the verification approach is consistent with the project’s reliability-first testing stance.
3. Given a developer wants to inspect what the demo proved, when they review the supporting documentation, then it explains what capabilities the demo covers, what remains intentionally out of scope at this stage, and what the next logical step is, and it makes clear that Pod sync is not required for the first validation path.
4. Given a developer or LLM-assisted builder wants to use the demo as a reference implementation, when they inspect the code and documentation together, then they can understand how the demo maps to the public API and the local-first mental model, and they can identify which parts are library behavior versus demo-specific scaffolding.
5. Given Epic 1 is considered complete, when the todo demo, docs, and validation path are reviewed together, then the repository demonstrates a coherent first-use experience that is simple, understandable, and trustworthy, and it provides a stable baseline for the later sync-focused epics.

## Tasks / Subtasks

- [x] Turn the demo verification path into an explicit first-proof workflow instead of an implicit collection of checks (AC: 1, 2, 5)
  - [x] Extend `scripts/test-demo.sh` so it covers the documented local-first flow end to end, including `task get`, restart-safe reuse of the same `--data-dir`, and at least one post-update or post-delete proof that the latest local state is what survives.
  - [x] Keep `npm run test:demo` aligned with the documented commands in `demo/README.md`; the script should prove the same workflow the reader is told to run, not a different hidden path.
  - [x] Do not turn this story into a second integration harness, browser demo, or Pod-sync validation story. The focus remains the local-only first proof of value.
- [x] Align the top-level and demo-facing docs with the real first-use path (AC: 1, 3, 5)
  - [x] Update `README.md` so the first-run and quick-start sections point to one coherent local-only proof path and mention the exact verification command surface a new adopter should trust first.
  - [x] Update `demo/README.md` so it explicitly states what the demo proves today: local entity definition, local CRUD, restart-safe persistence, and inspectable local state.
  - [x] In the same docs, state clearly what is still out of scope for the first proof: Pod sync, remote durability, multi-device behavior, and broader interoperability claims remain later-epic concerns.
- [x] Make the demo-to-public-API mapping easy to inspect (AC: 3, 4)
  - [x] Add or tighten documentation that points readers from the demo workflow to the relevant library concepts: `defineEntity(...)`, `createEngine(...)`, local CRUD methods, and the Node-specific SQLite adapter path.
  - [x] Explain which files are demo scaffolding versus library/runtime surface, using the current repo structure rather than abstract descriptions.
  - [x] Keep the explanation small and concrete; a developer should not need to infer this distinction by reading internals in random order.
- [x] Keep the reliability story explicit in tests and docs (AC: 2, 5)
  - [x] Update `docs/TESTING.md` and any closely related developer-facing testing guidance only as needed so `npm run test:demo` is clearly described as the demo regression harness and first-proof validation path.
  - [x] Preserve the repo’s behavior-first stance: prefer proving the documented workflow through CLI behavior and the existing shell harness over adding brittle implementation-coupled assertions.
  - [x] Ensure the story does not weaken the required verification bar of `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.
- [x] Protect the documented workflow against drift with focused regression coverage (AC: 1, 2, 4, 5)
  - [x] Extend `tests/demo-cli.test.ts` only where the current suite does not already prove the same behavior as the documented first-run path.
  - [x] If docs or help text change, keep `demo/cli.ts` help output, `demo/README.md`, `README.md`, and the smoke script aligned in one pass.
  - [x] Do not re-test core engine internals here; rely on the existing public API and demo behavior layers unless this story reveals a real mismatch.

## Dev Notes

### Story Intent

Story 1.5 is a trust-hardening story. The repo already has the todo/task entity, local CRUD, and restart-safe persistence. The missing piece is a single coherent proof path that a new adopter can run, inspect, and believe without having to stitch together several docs and scripts mentally. The implementation should therefore emphasize verification-path clarity and documentation alignment, not new engine features. Sources: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:366), [README.md](/media/michal/data/code/lofipod/README.md:9), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

### Critical Guardrails

- Keep the root package framework-agnostic and environment-neutral. Story 1.5 should live mainly in docs, demo-layer files, and behavior tests, not by pushing Node- or CLI-specific concerns into `src/index.ts` or shared engine internals. Sources: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:13), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18), [src/index.ts](/media/michal/data/code/lofipod/src/index.ts:1)
- Do not reopen CRUD or persistence design. Stories 1.3 and 1.4 already established the current demo task flow and SQLite-backed restart-safe local state; this story should verify and explain that path, not redesign it. Sources: [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1), [1-4-persist-the-todo-demo-across-restart.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-4-persist-the-todo-demo-across-restart.md:1)
- Keep the first proof local-only. Pod sync must remain clearly optional and later in the learning path; do not make Story 1.5 depend on `sync bootstrap`, `sync now`, or any Solid setup to satisfy its acceptance criteria. Sources: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:381), [README.md](/media/michal/data/code/lofipod/README.md:11), [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:47)
- Prefer proving behavior through the documented surfaces that already exist: `npm run demo`, `scripts/test-demo.sh`, and `tests/demo-cli.test.ts`. Do not add a second hidden verification mechanism that drifts from user-facing commands. Sources: [package.json](/media/michal/data/code/lofipod/package.json:31), [scripts/test-demo.sh](/media/michal/data/code/lofipod/scripts/test-demo.sh:1), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- Be explicit about scope boundaries in the docs. The first proof should say what it covers now and what later epics add, so developers and LLM-assisted builders do not infer unsupported sync or interoperability guarantees too early. Sources: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:381), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:152), [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:17)

### Current Codebase State

#### `README.md`

Current state:

- The root README already frames the first run as local only and points readers to `docs/QUICKSTART.md` and `demo/README.md`.
- Its concrete command snippet still shows only add/list/done, which is smaller than the now-supported CRUD plus restart-safe proof.
- It does not yet clearly explain the verification path for the demo as a trustworthy adoption check.

What this story likely changes:

- Tighten the first-run and quick-start narrative so the top-level doc points at one explicit first-proof workflow.
- Possibly mention `npm run test:demo` as the repeatable verification command for the repo demo.

What must be preserved:

- The framework-agnostic core positioning.
- The local-first-before-sync learning sequence.
- The small, human-readable README style.

Source: [README.md](/media/michal/data/code/lofipod/README.md:1)

#### `demo/README.md`

Current state:

- The demo README already explains the local SQLite-backed state location, the restart-safe same-`--data-dir` workflow, and the supported task CRUD commands.
- It still stops short of clearly labeling itself as the repo’s authoritative first-proof checklist and of separating “proves now” from “comes later with sync”.

What this story likely changes:

- Add a concise section describing what the demo proves today, what it intentionally does not prove yet, and what next step leads into Epic 2.
- Keep the command examples synchronized with the actual CLI and smoke script.

What must be preserved:

- The local-only first-run path.
- The task-first demo surface.
- The existing restart-safe persistence explanation and file-location guidance.

Source: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)

#### `scripts/test-demo.sh`

Current state:

- The shell harness validates `help`, `task add`, `task list`, `task done`, `journal add`, and `journal list`.
- It does not yet prove the full documented task CRUD flow, explicit single-item reads, or the restart-safe “stop and rerun with the same data directory” path that the docs now describe.

What this story likely changes:

- Expand the smoke script so it validates the actual documented first-proof workflow, not just a subset.
- Keep it fast, shell-simple, and suitable for `npm run test:demo`.

What must be preserved:

- The focus on the demo CLI as an end-to-end behavior harness.
- Fast execution and simple grep-based assertions.
- Separation from the heavier Pod integration suite.

Source: [scripts/test-demo.sh](/media/michal/data/code/lofipod/scripts/test-demo.sh:1)

#### `tests/demo-cli.test.ts`

Current state:

- The Vitest suite already covers task add/get/list/done/delete, journal add/list, restart-safe persistence for add/done/delete, top-level help, and unconfigured sync status.
- This means much of Story 1.5’s required verification already exists in TypeScript tests even where the shell harness and top-level docs lag behind.

What this story likely changes:

- Add focused coverage only if a documented workflow detail is not already protected.
- Use the existing suite as the authoritative signal for whether documentation or help text drifted.

What must be preserved:

- Behavior-first testing through the demo surface.
- Temporary-directory isolation patterns.
- Existing sync-status and restart-safety checks.

Source: [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)

#### `docs/TESTING.md`

Current state:

- The testing guide already names `npm run test:demo` as the demo regression harness.
- It does not yet explicitly connect that command to the demo’s role as the first proof of value for adopters and maintainers.

What this story likely changes:

- Clarify that `test:demo` is the explicit repeatable validation path for the documented local-first demo workflow.

What must be preserved:

- The reliability-first testing hierarchy.
- The distinction between the fast suite, demo harness, and real Pod integration tests.

Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)

#### `demo/cli.ts` and `demo/app.ts`

Current state:

- The CLI already exposes the task and journal flows needed for the first proof path.
- `createDemoApp(...)` already wires the demo through `createEngine(...)` and `createSqliteStorage(...)`, giving a clean mapping from demo behavior to the public API and Node entrypoint.

What this story likely changes:

- Possibly only help text or small explanatory cues if needed for documentation alignment.
- No production behavior change unless the documented path reveals a real mismatch.

What must be preserved:

- Current command grammar and output style.
- Existing SQLite-backed local-only behavior.
- Clean separation between demo shell logic and application orchestration.

Sources: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)

### Architecture Compliance

- The public surface remains intentionally small and explicit. This story should explain and verify that surface through the demo rather than expanding it. Sources: [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:151), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:18)
- The demo is explicitly part of the project’s regression strategy, not throwaway sample code. Its docs and tests should therefore be treated as product-facing trust artifacts. Sources: [README.md](/media/michal/data/code/lofipod/README.md:68), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:34), [docs/development-guide.md](/media/michal/data/code/lofipod/docs/development-guide.md:62)
- Local writes commit first and remote sync is layered later. The first-proof documentation should keep that mental model obvious and should not imply that remote behavior is part of Epic 1 validation. Sources: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:75), [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:66), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:65)

### Previous Story Intelligence

- Story 1.3 completed the full local task CRUD demo path and aligned `demo/README.md`, `demo/cli.ts`, and `tests/demo-cli.test.ts` around that surface.
- Story 1.4 confirmed that restart-safe local persistence is already live, documented the SQLite-backed `state.sqlite` path, and extended restart coverage for done/delete cases.
- The remaining gap is therefore not missing capability but missing coherence: the root README, demo verification script, and testing docs still need to present one stable adoption proof instead of partially overlapping views.

Sources: [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1), [1-4-persist-the-todo-demo-across-restart.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-4-persist-the-todo-demo-across-restart.md:1)

### Git Intelligence

Recent commits:

- `c808a69` `improving the demo`
- `8aa3aee` `crud in demo`
- `00a7745` `simplifying the demo entity`

Actionable takeaways:

- `c808a69` already strengthened restart proof and docs, but its changed-file set shows the trust story remains distributed across README-adjacent docs, demo docs, tests, and BMAD artifacts rather than a single explicit proof path.
- `8aa3aee` established the CRUD surface in `demo/app.ts`, `demo/cli.ts`, `demo/README.md`, and `tests/demo-cli.test.ts`, so Story 1.5 should extend that same slice instead of inventing a parallel demo or second command grammar.
- `00a7745` kept the demo entity intentionally small. Story 1.5 should preserve that clarity and resist feature creep while documenting the demo as a reusable bounded example.

Sources: `git log --oneline -5`, `git show --stat --oneline c808a69`, `git show --stat --oneline 8aa3aee`

### Testing Requirements

- Expected validation for substantive changes remains `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` when the environment allows. Sources: [AGENTS.md](/media/michal/data/code/lofipod/AGENTS.md:1), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:45)
- Prefer behavior-focused checks through `npm run demo`, `tests/demo-cli.test.ts`, and `scripts/test-demo.sh` before reaching for internals. Sources: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:11), [docs/development-guide.md](/media/michal/data/code/lofipod/docs/development-guide.md:127)
- The highest-value regression for this story is drift detection between documented commands and the real demo behavior. If documentation expands the first-proof path, the shell harness and CLI tests should make that path expensive to break silently.

### Latest Technical Information

- TypeScript `6.0` is now the official current major for the repo’s pinned `^6.0.3`, and its release notes call out deprecations around older module-resolution and compatibility defaults. Keep touched docs and test examples aligned with the repo’s strict modern ESM posture instead of reintroducing legacy guidance. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest `4`’s official migration guide says it requires Node `>=20` and notes more accurate V8 coverage remapping. Any test additions in this story should keep using current Vitest patterns and avoid stale migration-era idioms. Source: https://main.vitest.dev/guide/migration
- The Node.js official blog shows `Node.js 24.15.0 (LTS)` published on April 15, 2026, which is compatible with the repo’s `node >=24` baseline. Treat modern Node 24 behavior as the supported development and demo runtime for this story. Source: https://nodejs.org/en/blog

### Implementation Strategy Notes

- Start by comparing the command sequence documented in `demo/README.md` and `README.md` against `scripts/test-demo.sh`; the fastest win is likely to make the explicit smoke script prove the same path the docs describe.
- If the root README remains intentionally shorter than `demo/README.md`, keep it short but make the handoff explicit: tell the reader exactly where the authoritative demo proof lives and which command verifies it.
- Prefer small explanatory sections such as “What this demo proves”, “What it does not prove yet”, and “How this maps to the library API” over long narrative rewrites.
- If you need to distinguish library behavior from demo scaffolding, use the existing file boundaries: `demo/entities.ts`, `demo/app.ts`, and `demo/cli.ts` consume the library; `src/` implements it.

### Project Structure Notes

- Root first-contact doc: [README.md](/media/michal/data/code/lofipod/README.md:1)
- Quick-start public API example: [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)
- Testing guide: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- Demo command guide: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- Demo CLI entry: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- Demo app wiring: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- Demo entity definitions: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- Demo regression harness: [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- Demo smoke script: [scripts/test-demo.sh](/media/michal/data/code/lofipod/scripts/test-demo.sh:1)

Detected variances and rationale:

- No dedicated UX artifact exists under `_bmad-output/planning-artifacts`, so the story’s developer-experience guidance comes from the epic text, PRD, project context, and live docs.
- The implementation gap is not missing local behavior. It is mismatch risk between what the docs imply, what `npm run test:demo` proves, and what a new adopter will interpret as the trusted first proof.

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [docs/development-guide.md](/media/michal/data/code/lofipod/docs/development-guide.md:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- [scripts/test-demo.sh](/media/michal/data/code/lofipod/scripts/test-demo.sh:1)
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:366)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [1-3-build-local-crud-for-the-in-repo-todo-demo.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-3-build-local-crud-for-the-in-repo-todo-demo.md:1)
- [1-4-persist-the-todo-demo-across-restart.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/1-4-persist-the-todo-demo-across-restart.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Story target auto-discovered from `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-5-verify-and-document-the-todo-demo-as-the-first-proof-of-value`
- Discovery results:
  - loaded epics from `_bmad-output/planning-artifacts/epics.md`
  - loaded PRD from `_bmad-output/planning-artifacts/prd.md`
  - no dedicated architecture artifact under `_bmad-output/planning-artifacts`; used live docs plus generated project context
  - no separate UX artifact found under `_bmad-output/planning-artifacts`
  - loaded persistent project facts from `_bmad-output/project-context.md`
- Repo analysis shows Epic 1’s runtime proof already exists across the demo CLI, restart-safe SQLite path, TypeScript CLI tests, and shell demo harness, but the proof is still scattered across several docs and not yet expressed as one stable adoption workflow.
- `tests/demo-cli.test.ts` already protects more of the documented local flow than `scripts/test-demo.sh` currently proves; Story 1.5 should likely close that gap rather than add new core behavior.
- Recent commit history confirms the intended surface for this story is README/demo docs/test harness alignment, not engine expansion.
- Latest-technology spot checks used official TypeScript, Vitest, and Node sources to confirm the current Node 24 + TypeScript 6 + Vitest 4 baseline remains current.
- Fresh implementation start detected: no `Senior Developer Review (AI)` section or review follow-up tasks are present in this story file.
- Implementation plan: align the documented first-proof command sequence across `scripts/test-demo.sh`, `tests/demo-cli.test.ts`, `README.md`, `demo/README.md`, and `docs/TESTING.md` without changing engine internals.

### Completion Notes List

- Added a single documented first-proof task workflow across `README.md`, `demo/README.md`, `scripts/test-demo.sh`, and `tests/demo-cli.test.ts`.
- Kept the first proof local-only and explicit about later-epic scope boundaries for Pod sync, remote durability, and multi-device behavior.
- Clarified the demo-to-public-API mapping so readers can distinguish demo scaffolding from library implementation without reading internals in arbitrary order.
- Verified the full required local validation bar with `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- `README.md`
- `_bmad-output/implementation-artifacts/1-5-verify-and-document-the-todo-demo-as-the-first-proof-of-value.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `demo/README.md`
- `docs/TESTING.md`
- `scripts/test-demo.sh`
- `tests/demo-cli.test.ts`

## Change Log

- 2026-05-02: Created Story 1.5 with comprehensive implementation context for demo verification, documentation alignment, and first-proof trust hardening.
- 2026-05-02: Implemented the explicit local-only first-proof workflow, aligned docs and demo regression coverage, and completed full repo validation.
