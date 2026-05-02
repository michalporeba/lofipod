# Story 2.3: Import Pod-Backed Todo Data Into Fresh Local State

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer using the same todo data across devices,
I want the app to pull supported Pod-backed data into fresh local state,
so that a new local instance can recover and use the same dataset.

## Acceptance Criteria

1. Given canonical todo data already exists in the remote sync target for the demo, when a developer starts a fresh local instance of the sync-enabled todo app, then the app can import the supported remote todo data into local state, and the recovered todos become available through the same local read and list workflow as locally created data.
2. Given the initial quick-start path did not require ontology work, when the developer reaches remote import behavior, then the documentation explains how canonical mapping now enables remote recovery and reuse, and the relationship between local entities and canonical remote data remains understandable.
3. Given the sync-enabled demo is used on a second device or fresh local state, when background sync or explicit initial recovery runs through the supported path, then the local app regains the current supported todo dataset without requiring manual reconstruction by the developer, and the resulting local state is consistent with the canonical remote representation.
4. Given remote data includes supported todo items created elsewhere through the same documented model, when those items are imported into local state, then they are projected into the normal local application shape, and the app continues to treat the local read model as the primary operational surface.
5. Given the demo is proving the first remote recovery path, when a developer reviews the story outcome, then they can see a clear, repeatable way for a new local instance to recover from canonical remote data, and the example remains small enough to understand without deep knowledge of internal sync machinery.

## Tasks / Subtasks

- [x] Prove the fresh-local bootstrap path through the demo's supported sync entrypoint rather than adding a parallel import mechanism. (AC: 1, 3, 5)
  - [x] Reuse `engine.sync.bootstrap()` through `demo/app.ts` and the `sync bootstrap` CLI command; do not invent a demo-only remote import abstraction.
  - [x] Add or tighten demo-level coverage showing a fresh `--data-dir` can import pre-existing canonical task data and then expose it through normal `task list` and `task get` flows.
  - [x] Keep the recovery path explicit and understandable: bootstrap is the first-attach import tool, not an always-on replacement for local reads.
- [x] Keep bootstrap aligned with the accepted additive first-attach policy. (AC: 1, 3, 4)
  - [x] Preserve the current behavior of importing missing local entities, skipping graph-identical entities, and reporting differing entities as collisions instead of overwriting either side.
  - [x] If demo coverage expands to mixed local/remote states, stop at proving/reporting collisions; defer automatic reconciliation policy work to Story 2.4.
  - [x] Preserve the local read model as the operational surface after import; imported tasks must be readable through ordinary app APIs rather than a special remote-inspection path.
- [x] Document the remote recovery path without turning the quick start into a Pod-first or ontology-first workflow. (AC: 2, 5)
  - [x] Update demo-facing docs to explain when canonical mapping matters: local-first first, bootstrap/recovery second.
  - [x] Clarify that canonical task resources under `tasks/<id>.ttl` are what make fresh-local recovery possible.
  - [x] Keep `docs/QUICKSTART.md` and the first local demo path usable without requiring Solid setup before the developer chooses to explore sync.
- [x] Add focused regression coverage around supported canonical import behavior. (AC: 1, 3, 4, 5)
  - [x] Keep tests behavior-focused through the public API, demo app, or CLI surface.
  - [x] Cover the import of supported task data and, where relevant, linked journal entries that reference imported task URIs.
  - [x] Reuse existing public-API bootstrap tests for engine semantics; add demo tests only where the demo layer introduces risk or documentation value.

## Dev Notes

### Story Intent

This story is not greenfield engine work. The engine-level bootstrap primitive already exists, the demo already exposes it via `sync bootstrap`, and there is already real-Pod coverage for importing canonical task and journal resources. The job here is to make that path the clear, repeatable demo recovery story, tighten any missing demo-level proof or documentation, and avoid drifting into Story 2.4's mixed-state reconciliation scope. [Source: [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:242), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:118), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1), [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1), [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:308)]

### Critical Guardrails

- Do not build a second remote-import subsystem in the demo. The supported path is `engine.sync.bootstrap()`, surfaced by `app.syncBootstrap()` and the `sync bootstrap` CLI command. [Source: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:304), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:207), [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:248)]
- Do not make bootstrap automatic on ordinary local reads or app startup just to satisfy the demo. The accepted API and architecture keep bootstrap explicit rather than automatic. [Source: [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:418), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:118)]
- Preserve the additive first-attach policy: import missing local entities, skip graph-identical entities, and report differing entities as collisions. Do not overwrite local state silently. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:122), [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:18), [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:5110)]
- Keep the root package framework-agnostic and environment-neutral. Any Solid or SQLite wiring must stay in `lofipod/node`, the demo layer, or Pod adapter code. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:14), [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)]
- Do not redesign the local operational model around remote state. Imported entities must end up in the same stored graph plus projected local read model used by normal CRUD and list flows. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:61), [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:56)]
- Keep collision handling bounded. If local and remote data both exist and differ, surface that condition and leave deeper reconciliation to Story 2.4 rather than smuggling merge policy into this slice. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:490), [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:5110)]

### Current Codebase State

#### `src/engine/remote-bootstrap.ts`

Current state:

- The bootstrap path already iterates canonical entities by entity definition.
- Missing local entities are projected into local storage using the normal entity `project(...)` function and written into the same local graph/projection model as local saves.
- Existing identical graphs are skipped, and differing existing entities are reported as collisions.
- After canonical import, observed remote change IDs are remembered so older remote log entries are not replayed again as fresh changes.

What this story should change:

- Likely little or nothing in the engine unless a demo-discovered gap appears.
- If a bug is found, keep the fix minimal and preserve explicit bootstrap semantics.

What must be preserved:

- Additive import only.
- Collision reporting without silent overwrite.
- Projection through the entity contract rather than demo-specific parsing.

Source: [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:1), [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:4980)

#### `demo/app.ts`

Current state:

- The demo app is still local-first by default and only attaches Pod sync explicitly.
- `syncBootstrap()` delegates directly to `engine.sync.bootstrap()`.
- Runtime-specific Pod wiring stays in the demo Node layer, not in the root package.

What this story should change:

- Keep the demo recovery path easy to follow and, if needed, make its behavior more explicit in docs or tests.

What must be preserved:

- Explicit `attachPodSync(...)` before bootstrap.
- No constructor-time mandatory Pod configuration for ordinary local app use.

Source: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)

#### `demo/cli.ts`

Current state:

- `sync bootstrap` attaches Pod sync and prints `imported=... skipped=... collisions=...`.
- The CLI already exposes the supported first-recovery surface without inventing internal-only commands.

What this story should change:

- Potentially tighten the user-facing narrative around when to use bootstrap and what its output means.
- Add coverage if current CLI tests under-specify the success path.

What must be preserved:

- A small CLI surface.
- Output that reflects engine bootstrap results directly.

Source: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:248), [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:476)

#### `tests/demo-pod.integration.test.ts`

Current state:

- There is already a focused real Community Solid Server test that creates canonical task and journal resources externally, runs `sync bootstrap` against a fresh local data directory, and then asserts `task list` and `journal list` show imported local data.

What this story should change:

- Audit whether that test fully proves the acceptance criteria or whether it needs small additions such as `task get`, clearer assertions about fresh-local recovery, or stronger documentation-aligned output checks.
- Keep the suite focused; do not bloat `npm run test:pod` with broad mixed-state permutations that belong in mocked public-API coverage or later stories.

What must be preserved:

- Real-Pod verification stays small and deliberate.
- Bootstrap proof remains behavior-focused through the demo surface.

Source: [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:308), [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:38)

#### `src/pod/solid.ts`

Current state:

- The Solid adapter can list canonical entity resources by container, parse Turtle files, and return root URI plus graph data to bootstrap.
- Missing canonical containers resolve to an empty list rather than an error, which keeps bootstrap bounded for absent entity families.

What this story should change:

- Probably nothing unless demo verification finds an adapter bug in canonical listing or parsing.

What must be preserved:

- Canonical import reads `tasks/<id>.ttl` and other `.ttl` resources as canonical data, not app-private log entries.

Source: [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:79)

### Architecture Compliance Notes

- The client-local store remains the primary query surface before and after bootstrap. Remote canonical data is recovery input, not the application's normal query engine. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:145), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:105)]
- The entity definition stays the contract between canonical RDF and application objects. Imported remote graphs must still flow through `project(...)`. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:48), [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:86)]
- Canonical entity directories are the mandatory recovery surface, while the app-private replication log is acceleration infrastructure rather than the only valid discovery mechanism. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:66), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:96)]

### Previous Story Intelligence

- Story 2.1 established explicit runtime attach. Story 2.3 must build on that rather than reintroducing constructor-time sync configuration as the visible pattern.
- Story 2.2 hardened the canonical task mapping and added real-Pod assertions around canonical task resources. Story 2.3 should reuse that mapping as the basis for recovery rather than redefining task RDF semantics.
- Story 2.2 also clarified that ontology details are not a prerequisite for the first local run. Story 2.3 should preserve that staging while explaining why canonical mapping now matters for recovery.

Source: [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1), [2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md:1)

### Git Intelligence

Recent commits:

- `849ee61` `ontology mapping`
- `1760afc` `attaching demo to a pod`
- `831603d` `version updates`
- `c1eb5bd` `a demo cli`
- `c808a69` `improving the demo`

Actionable takeaways:

- Recent sync work updates the story artifact, sprint status, demo docs, demo code, and focused tests together. Follow that pattern rather than landing a code-only bootstrap tweak.
- `ontology mapping` already touched the real-Pod demo test and docs; Story 2.3 should extend those assets instead of creating a separate recovery narrative elsewhere.
- `attaching demo to a pod` established the current demo `attach -> bootstrap/now/status` command pattern. Preserve that flow and vocabulary.
- `version updates` was dependency maintenance. Avoid opportunistic package changes unless a bootstrap bug requires them.

Source: `git log --oneline -5`, `git show --stat --oneline -1 849ee61`, `git show --stat --oneline -1 1760afc`

### Testing Requirements

- Run `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` for substantive implementation if the environment allows. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:47), [docs/development-guide.md](/media/michal/data/code/lofipod/docs/development-guide.md:1)]
- Prefer behavior-focused verification through `lofipod` public entrypoints, the demo app, and the CLI rather than internal-only tests. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:9)]
- High-value regressions for this story:
  - fresh-local bootstrap imports canonical task data into normal local task reads
  - imported journal entries still reference imported task IDs correctly
  - identical existing local data is skipped cleanly where tested
  - differing local-vs-remote data is surfaced as collisions, not overwritten
  - docs and CLI behavior describe bootstrap as explicit first recovery rather than implicit background magic
- Keep `npm run test:pod` small. Broader collision matrices belong in mocked public-API tests or Story 2.4, not in an expanded real-server suite. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:38), [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:5110)]

### Latest Technical Information

- TypeScript 6.0 is the current major line, and its official release notes updated on April 13, 2026 emphasize ongoing deprecations ahead of TypeScript 7.0. If any tooling or tsconfig guidance is touched while implementing this story, keep the repo aligned with modern bundler-based ESM TypeScript rather than reintroducing legacy module-resolution advice. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest 4's official migration guide still requires Node.js `>=20`. This repo targets Node `>=24`, so any new tests for bootstrap should use current Vitest patterns and should not add compatibility workarounds for older runtimes. Source: https://vitest.dev/guide/migration
- As of May 2, 2026, Node.js v24 remains an LTS line, and the Node release schedule shows v24 "Krypton" last updated on April 15, 2026. The repo's Node 24 baseline remains aligned with current supported releases. Source: https://nodejs.org/ja/about/previous-releases
- Inrupt's current Node authentication guidance still centers `@inrupt/solid-client-authn-node` on a `Session` whose authenticated `fetch` performs Pod requests. If demo docs or examples touch authenticated runtime wiring, keep that concern in the Node-side adapter/app layer rather than moving auth concepts into the core engine. Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Implementation Strategy Notes

- Start by auditing whether the existing real-Pod bootstrap test and docs already satisfy most of the story. This slice may be closer to hardening and documentation than to new engine code.
- If the acceptance criteria are already mostly met, prefer the smallest set of additions that close any proof gaps: a clearer doc section, a stronger CLI/demo assertion, or a narrowly scoped bug fix.
- Do not treat background sync polling or remote log replay as the same thing as first recovery. Story 2.3 is about fresh-local recovery from canonical resources; later stories cover ongoing remote changes and richer failure handling.
- Keep linked journal behavior green if bootstrap coverage touches both entity families. The task URI contract remains a dependency.
- Preserve token-efficient, inspectable outputs. The CLI's bootstrap summary is already a good bounded surface; extend it only if there is a concrete diagnostic gap.

### Project Structure Notes

- Demo entity mapping: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- Demo app/runtime sync wiring: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- Demo CLI bootstrap/status commands: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- Demo guide: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- Engine bootstrap path: [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:1)
- Engine sync surface: [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:1)
- Solid adapter canonical listing: [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:1)
- Public-API bootstrap regression coverage: [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:4980)
- Real-Pod demo bootstrap coverage: [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:308)

### Detected Variances and Rationale

- There is no separate UX artifact under `_bmad-output/planning-artifacts`; UX guidance for this story comes from the epic wording, PRD, and existing docs.
- The planning-artifact architecture file is absent, so the current architecture baseline is [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1), which is also named in the PRD inputs.
- The repository already contains the central bootstrap mechanics and a real-Pod demo bootstrap test while sprint status still marks Story 2.3 as backlog. Treat this as evidence that the implementation may be partial or ahead of tracking; the developer should verify story completeness against the ACs instead of assuming missing engine work.
- Because Story 2.4 explicitly owns mixed local-and-remote first-attach policy, Story 2.3 should avoid absorbing that scope under the excuse of "completing bootstrap."

### References

- [README.md](/media/michal/data/code/lofipod/README.md:1)
- [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:1)
- [docs/API.md](/media/michal/data/code/lofipod/docs/API.md:1)
- [docs/PLANS.md](/media/michal/data/code/lofipod/docs/PLANS.md:1)
- [docs/WIP.md](/media/michal/data/code/lofipod/docs/WIP.md:1)
- [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1)
- [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:1)
- [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:1)
- [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:1)
- [src/engine/remote-bootstrap.ts](/media/michal/data/code/lofipod/src/engine/remote-bootstrap.ts:1)
- [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [tests/demo-cli.test.ts](/media/michal/data/code/lofipod/tests/demo-cli.test.ts:1)
- [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:466)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1)
- [2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /media/michal/data/code/lofipod/_bmad/scripts/resolve_customization.py --skill /media/michal/data/code/lofipod/.agents/skills/bmad-create-story --key workflow`
- `sed -n '1,260p' /media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sed -n '460,560p' /media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md`
- `git log --oneline -5`
- `git show --stat --oneline -1 849ee61`
- `git show --stat --oneline -1 1760afc`
- Source, architecture, demo, and test reads listed during workflow analysis
- Latest-technology checks from official TypeScript, Vitest, Node.js, and Inrupt documentation
- `npx vitest run tests/demo-cli.test.ts`
- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

### Completion Notes List

- Tightened the real-Pod demo bootstrap regression to prove a fresh local data directory starts empty, imports supported canonical task data through `sync bootstrap`, and then serves the recovered task through ordinary `task get` and `task list` commands.
- Documented the demo recovery path as explicit first-attach bootstrap from canonical `tasks/<id>.ttl` resources and kept the quick-start flow local-first before sync setup.
- Verified the existing additive bootstrap policy remains the supported behavior and left mixed local/remote reconciliation scope for Story 2.4.
- Validation completed with `npx vitest run tests/demo-cli.test.ts`, `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- _bmad-output/implementation-artifacts/2-3-import-pod-backed-todo-data-into-fresh-local-state.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- demo/README.md
- docs/QUICKSTART.md
- tests/demo-pod.integration.test.ts

### Change Log

- 2026-05-02: Tightened fresh-local bootstrap proof in the Pod-backed demo test and documented explicit recovery from canonical task resources without changing engine bootstrap semantics.
