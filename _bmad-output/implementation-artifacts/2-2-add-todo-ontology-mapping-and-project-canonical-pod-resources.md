# Story 2.2: Add Todo Ontology Mapping and Project Canonical Pod Resources

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer connecting the todo demo to a Solid Pod,
I want to add ontology-backed canonical mapping when sync is introduced,
so that local todo changes can become reusable Pod data without making ontology design a quick-start prerequisite.

## Acceptance Criteria

1. Given the todo demo already works locally and Pod sync is being introduced, when the developer adds canonical mapping for the todo entity, then the mapping defines the RDF type, predicates, and Pod placement needed for canonical Pod storage, and this mapping step is introduced as part of Pod sync rather than as a requirement of the initial local-first walkthrough.
2. Given Pod sync is attached to the sync-enabled todo demo, when a developer creates or updates a todo locally, then the local operation completes through the normal local-first workflow, and the corresponding canonical Pod resource is updated in the background using the configured ontology-backed mapping.
3. Given a todo exists in the sync-enabled demo, when the developer deletes it locally, then the canonical Pod-side representation is removed or updated according to the supported deletion semantics, and the remote effect remains consistent with the documented bounded model.
4. Given local todo changes are projected to the Pod, when a developer inspects the remote result, then the canonical data is represented in the documented RDF form intended for reuse, and it is not hidden only inside app-private storage structures.
5. Given the todo demo is the reference implementation for early sync behavior, when a developer reviews the code and documentation for this story, then they can see clearly where local-first entity definition ends and canonical Pod mapping begins, and the explanation keeps ontology work understandable and scoped to the sync use case rather than the initial quick-start path.

## Tasks / Subtasks

- [x] Make the task entity's canonical Pod mapping explicit, stable, and sync-scoped (AC: 1, 4, 5)
  - [x] Keep the bounded local task shape unchanged unless a separate API or model change is intentionally approved: `id`, `title`, `status`, and optional `due`.
  - [x] Treat `pod.basePath`, `rdfType`, `uri(...)`, `toRdf(...)`, and `project(...)` in `TaskEntity` as the canonical mapping contract and clarify that boundary in code comments or surrounding docs.
  - [x] If the in-code vocabulary and `demo/ontology` assets diverge, reconcile them in one pass rather than leaving code and ontology docs to drift independently.
- [x] Prove canonical task resource projection for create and update flows through the explicit attach path from Story 2.1 (AC: 1, 2, 4)
  - [x] Extend the demo Pod integration path to assert the task canonical resource lives under `tasks/<id>.ttl`.
  - [x] Assert the canonical Turtle output contains the expected RDF type, task title predicate, task status predicate, and EDTF-typed due literal.
  - [x] Add coverage for updating an already-synced task so the canonical task resource changes in place without breaking the local-first CLI flow.
- [x] Prove supported deletion semantics for canonical task resources (AC: 3)
  - [x] Add demo-level coverage that deleting a synced task removes the canonical Turtle resource or otherwise matches the current documented deletion semantics.
  - [x] Reuse the existing engine and adapter delete path; do not add demo-only special cases for remote deletion.
- [x] Keep ontology work understandable and out of the initial local-only walkthrough (AC: 1, 5)
  - [x] Update demo-facing docs so the local-first path still comes first and the canonical ontology/resource explanation comes second.
  - [x] Keep `docs/QUICKSTART.md` and the demo narrative usable without requiring a developer to start by reading `demo/ontology/lifegraph-demo.ttl`.
  - [x] Explain clearly that the demo-owned ontology terms are an app-level mapping choice layered on top of the same local-first programming model.
- [x] Add focused regression coverage for mapping invariants without duplicating engine internals (AC: 2, 4, 5)
  - [x] Extend `tests/demo-entities.test.ts` or adjacent demo tests for task mapping invariants and unsupported term handling.
  - [x] Reuse existing public-API and Pod adapter coverage for engine-level sync semantics; add demo tests only where the demo layer itself adds risk.
  - [x] Keep `tests/demo-pod.integration.test.ts` small and behavior-focused so `npm run test:pod` remains a targeted regression gate.

## Dev Notes

### Story Intent

This story is not a greenfield "add RDF for the first time" slice. The repo already has demo-owned ontology terms, RDF mapping, and canonical resource projection in place. The real job here is to make the task canonical mapping explicit and trustworthy as the sync-facing contract, add the missing demo-level update/delete coverage, and keep the local-first walkthrough free from unnecessary ontology-first friction. [Source: [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:433), [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:41), [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:93)]

### Critical Guardrails

- Do not move Solid-specific or Turtle-serialization concerns into the root `lofipod` entrypoint. The core package stays environment-neutral; Node-specific storage and Pod adapter wiring remain on `lofipod/node` and in the demo layer. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:20), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:27), [src/node.ts](/media/michal/data/code/lofipod/src/node.ts:1)]
- Do not redesign local CRUD around remote state. Story 2.1 already established explicit runtime attach; this story must keep local task create/update/delete succeeding locally before background remote projection occurs. [Source: [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1), [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:57)]
- Do not invent a demo-only mapping abstraction outside `defineEntity(...)`. In this repo, the entity definition is the contract between application objects, stored canonical graphs, and canonical Pod resources. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:48), [src/types.ts](/media/michal/data/code/lofipod/src/types.ts:36)]
- Preserve the bounded model. Keep the task entity shallow and the canonical task resource simple; do not expand this story into deep graph semantics, generalized ontology management, or multi-app interoperability policy work. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:29), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:107)]
- Reuse the existing canonical delete path. The engine already projects deletion changes by calling `deleteEntityResource(...)` and then appending a retraction-only log entry; the demo should prove that path rather than reimplement it. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:90), [src/engine/remote-push.ts](/media/michal/data/code/lofipod/src/engine/remote-push.ts:37)]

### Current Codebase State

#### `demo/entities.ts`

Current state:

- `TaskEntity` already carries a concrete canonical mapping: `pod.basePath` is `tasks/`, `rdfType` is `mlg:Task`, `schema:name` carries the title, `mlg:status` carries the task state, and `mlg:due` uses the custom `mlg:edtf` datatype.
- `JournalEntryEntity` already depends on the task URI pattern through `aboutTaskId`, so task URI or vocabulary changes will affect journal compatibility.
- The local-first task shape is already the bounded todo pattern expected by earlier stories.

What this story should change:

- Make the canonical task mapping easier to read as the sync-facing layer of the demo.
- Tighten or clarify the ontology/documentation boundary if the code and ontology assets are drifting.
- Add coverage for task update/delete projection, which is not yet fully proven through the demo path.

What must be preserved:

- Stable task identity and task URI derivation.
- Deterministic `toRdf(...)` and `project(...)`.
- Journal entry links to task resources.

Source: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:24)

#### `demo/ontology/lifegraph-demo.ttl` and `demo/ontology/README.md`

Current state:

- The demo already ships an `mlg` ontology draft with `mlg:Task`, `mlg:status`, `mlg:due`, `mlg:Todo`, and `mlg:Done`.
- The ontology docs position this as a demo-owned subset rather than a mandatory first-run prerequisite.

What this story should change:

- Reconcile these assets with the actual task mapping if any term names, ranges, or narrative have drifted.
- Keep the ontology readable as canonical-Pod context, not as a barrier to the local-only first run.

What must be preserved:

- The namespace `https://michalporeba.com/ns/lifegraph#`.
- The EDTF datatype narrative already used by task due dates and journal entry dates.

Source: [demo/ontology/lifegraph-demo.ttl](/media/michal/data/code/lofipod/demo/ontology/lifegraph-demo.ttl:1), [demo/ontology/README.md](/media/michal/data/code/lofipod/demo/ontology/README.md:1)

#### `tests/demo-pod.integration.test.ts`

Current state:

- The demo already proves task and journal canonical resources are created on a real Community Solid Server and that bootstrap can import pre-existing canonical resources.
- The test currently verifies task creation and journal creation, but it does not yet prove task update semantics or canonical task deletion semantics through the demo path.

What this story should change:

- Extend the existing demo Pod path rather than creating a separate harness.
- Add assertions that inspect the task Turtle resource for the intended canonical RDF structure and lifecycle behavior.

What must be preserved:

- Focused real-Pod scope suitable for `npm run test:pod`.
- Behavior-level assertions over the demo surface, not deep engine internals.

Source: [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:93)

#### `src/pod/solid.ts` and `src/pod/solid-canonical-rdf.ts`

Current state:

- The Solid adapter already writes canonical resources as Turtle and remote log entries as N-Triples.
- Canonical resource creation uses `PUT`, updates use N3 Patch over `PATCH`, canonical reads parse Turtle, and container listing only considers `.ttl` resources under the entity base path.

What this story should change:

- Likely nothing in the adapter unless the demo exposes a real mismatch between intended task mapping and actual serialized task output.
- The main role of these files in Story 2.2 is as a contract the demo mapping and tests must align with.

What must be preserved:

- Turtle as the canonical resource format.
- Per-entity directories and `.ttl` resource names.
- Adapter-driven canonical write/delete behavior.

Source: [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:33), [src/pod/solid-canonical-rdf.ts](/media/michal/data/code/lofipod/src/pod/solid-canonical-rdf.ts:18)

#### `demo/README.md` and `docs/QUICKSTART.md`

Current state:

- Both documents already keep the local-first path first and the sync/canonical story second.
- `docs/QUICKSTART.md` still uses explicit RDF mapping in the minimal example, but that is framed as a small app-owned vocabulary rather than requiring the reader to design an ontology from scratch.

What this story should change:

- Explain the task canonical mapping and ontology file as part of the sync-enabled demo path.
- Keep the reader from feeling that they must understand the ontology draft before they can get local value.

What must be preserved:

- The quick-start local flow.
- The distinction between local state, canonical Pod data, and app-private log data.

Source: [demo/README.md](/media/michal/data/code/lofipod/demo/README.md:140), [docs/QUICKSTART.md](/media/michal/data/code/lofipod/docs/QUICKSTART.md:1)

### Architecture Compliance

- The root public surface remains `defineVocabulary(...)`, `defineEntity<T>(...)`, `createEngine(...)`, CRUD, sync lifecycle, and RDF helpers; Story 2.2 should not widen that surface casually. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:27)]
- Canonical current-state entity files belong under per-entity directories as Turtle resources, while app-private replication logs remain separate infrastructure in N-Triples. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:50), [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:98)]
- Application-facing reads and lists remain local-first; the Pod is the durable store and interoperability surface, not the main query engine. [Source: [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:118)]
- Local writes must commit before remote sync work. Any canonical-resource assertions added in this story must preserve that sequencing. [Source: [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:57), [docs/ADR.md](/media/michal/data/code/lofipod/docs/ADR.md:79)]

### Previous Story Intelligence

- Story 2.1 already established that the demo should attach sync explicitly at runtime through `engine.sync.attach(...)`.
- The previous story added regression coverage that task/journal commands stay local-first even if Pod env vars are present.
- Story 2.2 should build directly on that attach path. Do not reintroduce constructor-time sync as the visible pattern just to make canonical tests easier to write.

Source: [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:21)

### Git Intelligence

Recent commits:

- `1760afc` `attaching demo to a pod`
- `831603d` `version updates`
- `c1eb5bd` `a demo cli`
- `c808a69` `improving the demo`
- `8aa3aee` `crud in demo`

Actionable takeaways:

- Demo work in this repo tends to update demo code, demo docs, tests, and the story artifact together. Follow that pattern instead of making an isolated code-only change.
- The recent `attaching demo to a pod` work already changed `demo/app.ts`, `demo/cli.ts`, `demo/README.md`, and demo tests. Story 2.2 should extend that flow rather than fork it.
- `version updates` touched dependency metadata only. Story 2.2 should not opportunistically upgrade libraries unless a real compatibility blocker appears.

Source: `git log --oneline -5`, `git show --stat --oneline -1 1760afc`, `git show --stat --oneline -1 c1eb5bd`

### Testing Requirements

- Run `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` for substantive implementation if the environment allows. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:35), [docs/development-guide.md](/media/michal/data/code/lofipod/docs/development-guide.md:53)]
- Prefer behavior-focused assertions through the demo CLI and supported public entrypoints rather than internal helper coupling. [Source: [docs/TESTING.md](/media/michal/data/code/lofipod/docs/TESTING.md:9)]
- For this story, the highest-value regressions are:
  - task canonical Turtle shape after create and update
  - canonical resource deletion semantics after local task delete
  - local CRUD staying unchanged while background projection occurs
  - docs and ontology assets matching the actual task mapping

### Latest Technical Information

- TypeScript 6.0 is now officially documented. The release notes updated on April 13, 2026 emphasize deprecations around legacy module resolution and older output targets. Keep any touched code aligned with the repo's strict modern ESM TypeScript posture instead of reintroducing legacy guidance. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest 4's official migration guide still requires Node.js `>=20`. The repo targets Node `>=24`, so demo and Pod integration tests should continue using current Vitest idioms rather than older migration-era patterns. Source: https://main.vitest.dev/guide/migration
- Node.js 24 remains a supported LTS line. The official Node.js 24.11.0 LTS release page and archive confirm the repo's Node 24 baseline is still current enough for the demo, Pod tests, and tooling assumptions. Source: https://nodejs.org/en/blog/release/v24.11.0 and https://nodejs.org/en/download/archive/v24.11.0
- Inrupt's current Node authentication guidance still centers `@inrupt/solid-client-authn-node` around a `Session` whose authenticated `fetch` performs Pod requests. If Story 2.2 touches authenticated demo guidance, keep that runtime wiring passed into the Node-side adapter rather than abstracting auth into the core engine. Source: https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/

### Implementation Strategy Notes

- Assume the smallest correct implementation is probably a refinement, not a new subsystem. The current repo already has task mapping and canonical projection.
- If canonical task output needs to become more inspectable, prefer strengthening task-specific assertions in the real Pod demo tests over adding new custom debugging commands.
- Do not split local-first entity definition and canonical mapping into separate divergent concepts. In this repo, the same entity definition already bridges local and canonical forms; the story should clarify that boundary, not fight it.
- If you need to update ontology docs, update the code comments and demo docs in the same pass so a reader sees one coherent story.
- Keep `JournalEntryEntity` green. Task URI or vocabulary changes must not quietly break journal bootstrap or canonical links.

### Project Structure Notes

- Demo entity and mapping layer: [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- Demo app/runtime sync attachment: [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- Demo CLI shell: [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- Demo ontology assets: [demo/ontology/README.md](/media/michal/data/code/lofipod/demo/ontology/README.md:1), [demo/ontology/lifegraph-demo.ttl](/media/michal/data/code/lofipod/demo/ontology/lifegraph-demo.ttl:1)
- Canonical Turtle serialization and Solid adapter behavior: [src/pod/solid-canonical-rdf.ts](/media/michal/data/code/lofipod/src/pod/solid-canonical-rdf.ts:1), [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:1)
- Demo Pod-backed regression coverage: [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:1)

### Detected Variances and Rationale

- There is no dedicated UX artifact under `_bmad-output/planning-artifacts`. UX guidance for this story therefore comes from the epic wording, PRD, and current docs rather than a separate UX spec.
- The planning-artifact path for architecture was absent; the current architecture baseline is [docs/architecture.md](/media/michal/data/code/lofipod/docs/architecture.md:1), which is also consistent with the PRD's own source list.
- The repo already contains ontology-backed demo mapping in `demo/entities.ts` and real-Pod canonical assertions in `tests/demo-pod.integration.test.ts`. Treat Story 2.2 as a hardening/clarification slice, not a first-introduction slice.
- `docs/QUICKSTART.md` already uses explicit RDF mapping. So "without making ontology design a quick-start prerequisite" should be interpreted as "do not require custom ontology authoring or `demo/ontology` reading before local-first value," not as "remove RDF hooks from the public examples."

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
- [demo/entities.ts](/media/michal/data/code/lofipod/demo/entities.ts:1)
- [demo/app.ts](/media/michal/data/code/lofipod/demo/app.ts:1)
- [demo/cli.ts](/media/michal/data/code/lofipod/demo/cli.ts:1)
- [demo/ontology/README.md](/media/michal/data/code/lofipod/demo/ontology/README.md:1)
- [demo/ontology/lifegraph-demo.ttl](/media/michal/data/code/lofipod/demo/ontology/lifegraph-demo.ttl:1)
- [src/types.ts](/media/michal/data/code/lofipod/src/types.ts:1)
- [src/engine.ts](/media/michal/data/code/lofipod/src/engine.ts:1)
- [src/engine/remote-push.ts](/media/michal/data/code/lofipod/src/engine/remote-push.ts:1)
- [src/pod/solid.ts](/media/michal/data/code/lofipod/src/pod/solid.ts:1)
- [src/pod/solid-canonical-rdf.ts](/media/michal/data/code/lofipod/src/pod/solid-canonical-rdf.ts:1)
- [tests/demo-entities.test.ts](/media/michal/data/code/lofipod/tests/demo-entities.test.ts:1)
- [tests/demo-pod.integration.test.ts](/media/michal/data/code/lofipod/tests/demo-pod.integration.test.ts:1)
- [tests/public-api.test.ts](/media/michal/data/code/lofipod/tests/public-api.test.ts:1)
- [epics.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md:396)
- [prd.md](/media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md:1)
- [project-context.md](/media/michal/data/code/lofipod/_bmad-output/project-context.md:1)
- [2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md](/media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/2-1-attach-pod-sync-to-the-todo-demo-without-changing-local-crud.md:1)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `python3 /media/michal/data/code/lofipod/_bmad/scripts/resolve_customization.py --skill /media/michal/data/code/lofipod/.agents/skills/bmad-create-story --key workflow`
- `sed -n '1,260p' /media/michal/data/code/lofipod/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sed -n '430,470p' /media/michal/data/code/lofipod/_bmad-output/planning-artifacts/epics.md`
- `git log --oneline -5`
- `git show --stat --oneline -1 1760afc`
- `git show --stat --oneline -1 831603d`
- Source, architecture, demo, ontology, and test reads listed in workflow analysis
- Latest-technology checks from official TypeScript, Vitest, Node, and Inrupt documentation
- `npx vitest run tests/demo-entities.test.ts`
- `npm run test:pod`
- `npm run verify`
- `npm run build`
- `npm run test:demo`

### Completion Notes List

- Story target auto-discovered from sprint status: `2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources`.
- Comprehensive context assembled from epic requirements, architecture, project rules, previous Story 2.1 implementation, current demo code, demo ontology assets, Pod integration tests, recent git history, and current official tooling/runtime documentation.
- The story explicitly captures the key repo variance that ontology-backed task mapping already exists in code and tests, so implementation should refine and harden that path rather than reintroduce RDF from scratch.
- Story moved from `ready-for-dev` to `in-progress`, then to `review` after completion.
- Fixed `TaskEntity.project(...)` so EDTF-typed `mlg:due` literals round-trip correctly instead of being dropped during projection.
- Clarified in code and docs that the bounded `TaskEntity` definition is also the demo's sync-scoped canonical Pod mapping contract for `tasks/<id>.ttl`.
- Added focused demo regression coverage for task mapping invariants plus canonical task create, update, and delete behavior against the Community Solid Server.
- Reconciled the ontology README example with the actual bounded canonical task resource by removing task-only metadata drift.
- Validation completed successfully with `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod`.

### File List

- `_bmad-output/implementation-artifacts/2-2-add-todo-ontology-mapping-and-project-canonical-pod-resources.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `demo/README.md`
- `demo/entities.ts`
- `demo/ontology/README.md`
- `docs/QUICKSTART.md`
- `tests/demo-entities.test.ts`
- `tests/demo-pod.integration.test.ts`

## Change Log

- 2026-05-02: clarified the demo task canonical mapping boundary, fixed EDTF due projection round-tripping, expanded demo mapping and Pod lifecycle coverage, and reconciled ontology/demo docs with the actual canonical task resource.
