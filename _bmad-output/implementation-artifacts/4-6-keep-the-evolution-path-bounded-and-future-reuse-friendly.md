# Story 4.6: Keep the Evolution Path Bounded and Future-Reuse Friendly

Status: done

## Story

As a developer planning beyond the first demo,  
I want the supported evolution path to stay constrained but compatible with future reuse,  
so that the Phase 1 model can grow without pretending to support arbitrary change.

## Acceptance Criteria

1. Given the project supports only a bounded class of entity evolution in Phase 1, when developers review the supported migration and evolution guidance, then it is clear which kinds of model changes are intentionally supported, and the documentation does not imply general-purpose schema evolution or arbitrary RDF mutation support.
2. Given a supported evolution path is being designed for the todo demo and later real applications, when that path affects canonical remote data semantics, then the resulting canonical model remains understandable and reusable enough to support future compatible applications, and the design does not require redefining the Phase 1 capability contract to preserve basic portability.
3. Given the architecture should remain open to future user-controlled remote backends beyond Solid Pods, when developers review the evolution constraints and compatibility guarantees, then they can distinguish core semantic guarantees from backend-specific implementation details, and the bounded evolution model still makes sense if additional remote storage mechanisms are added later.
4. Given a developer is deciding whether the product is honest about its scope, when they inspect the Epic 4 outcomes and surrounding documentation, then they can see that `lofipod` supports a practical constrained evolution path rather than claiming universal migration safety, and that honesty strengthens trust in the product long-term direction.
5. Given Epic 4 is considered complete, when the evolution, migration, explanation, and compatibility stories are reviewed together, then the repository demonstrates a coherent bounded path for changing the app model without losing trust or destroying portable semantics, and that path provides a stable foundation for later adoption-hardening work.

## Tasks / Subtasks

- [x] Consolidate and clarify bounded evolution scope in developer-facing docs. (AC: 1, 4, 5)
  - [x] Update `docs/ADR.md` and `docs/API.md` so the supported evolution boundary is explicit and consistent.
  - [x] Ensure wording explicitly excludes arbitrary schema evolution and arbitrary RDF mutation support.
- [x] Strengthen architecture guidance for canonical portability. (AC: 2, 3, 5)
  - [x] Update `docs/architecture.md` to separate core semantic guarantees from Solid-specific transport details.
  - [x] Ensure canonical Turtle semantics are described as reusable across compatible future applications.
- [x] Align quickstart/demo messaging with bounded evolution guarantees. (AC: 1, 2, 4)
  - [x] Update `demo/README.md` and any migration/evolution sections so claims match implemented scope.
  - [x] Cross-check wording against Epic 4 story outcomes (4.1-4.5) to avoid over-claiming.
- [x] Add regression checks for documentation/API consistency. (AC: 1, 4, 5)
  - [x] Add or update behavior-focused tests where docs imply inspectable API behavior (for example migration/sync-state fields already delivered in 4.5).
  - [x] Keep checks scoped to public API and observable output paths.
- [x] Finalize Epic 4 coherence proof in repo docs. (AC: 5)
  - [x] Update `docs/WIP.md` and plan-facing notes to show the bounded evolution contract as complete for Phase 1.

### Review Findings

- [x] [Review][Patch] Latest-outcome regression test did not prove the earlier entity outcome was replaced; added a negative assertion for `task-migration-latest-a` [tests/demo-cli.test.ts]
- [x] [Review][Patch] Bounded-evolution disclaimer was repeated across onboarding and architecture docs; kept the contract in `docs/ADR.md` and `docs/API.md` and replaced repeats with links to `API.md#bounded-evolution-contract` [demo/README.md, docs/QUICKSTART.md, docs/architecture.md, docs/API.md]
- [x] [Review][Verified] Documented migration fields (`migration.lastLocalOutcome`, `migration.lastCanonicalRemoteOutcome`) exist in the public sync-state type [src/types.ts]

## Dev Notes

### Epic Context

- Story 4.6 is the capstone for Epic 4 and is primarily a scope/contract hardening story.
- Stories 4.1-4.5 already implemented evolution mechanics, migration behavior, canonical compatibility, and inspectable outcomes.
- This story must make those boundaries explicit, consistent, and future-reuse friendly without expanding implementation scope.

[Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.6)]

### Current State: Relevant UPDATE Files

- `docs/ADR.md`
  - Current state: accepted architectural constraints already emphasize bounded scope and non-goals.
  - Story change: tighten evolution boundary language and future-backend portability framing.
  - Must preserve: accepted decisions, especially framework-agnostic core and bounded model claims.

- `docs/API.md`
  - Current state: public API and current limits are documented, including sync/migration inspection fields.
  - Story change: clearly map supported evolution paths and non-goals to the developer-facing API contract.
  - Must preserve: small explicit API shape and local-first mental model.

- `docs/architecture.md`
  - Current state: layered architecture with Solid-first adapter implementation and reusable canonical data intent.
  - Story change: sharpen distinction between core semantics and backend-specific implementation details.
  - Must preserve: layering, adapter boundaries, and canonical-vs-log split.

- `demo/README.md`, `README.md`, `docs/QUICKSTART.md`
  - Current state: onboarding and demo flows are practical and local-first.
  - Story change: ensure no documentation text implies unbounded schema evolution or universal migration guarantees.
  - Must preserve: concise first-run path and trust-focused messaging.

- `docs/WIP.md`, `docs/PLANS.md`
  - Current state: working memory and roadmap notes mention bounded scope.
  - Story change: keep status factual and coherent with Epic 4 completion semantics.
  - Must preserve: factual project memory and concise roadmap.

### Architecture Compliance

- Keep core `lofipod` framework-agnostic and environment-neutral.
- Keep browser/Node runtime specifics in `lofipod/browser` and `lofipod/node`.
- Preserve canonical Pod Turtle resources as reusable data and app-private N-Triples replication log as infrastructure.
- Keep local-first CRUD primary and sync background-oriented.
- Do not introduce claims or APIs suggesting arbitrary schema migration or arbitrary foreign RDF merge support.

[Source: `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `_bmad-output/project-context.md`]

### Previous Story Intelligence

From Story 4.5 and recent commits:

- Migration inspectability now exists via `migration.lastLocalOutcome` and `migration.lastCanonicalRemoteOutcome`.
- Failure paths are explicitly surfaced; this story should not soften those boundaries.
- Recent work already touched API/docs/demo for migration outcomes; reuse those wording and structures to avoid divergence.

[Source: `_bmad-output/implementation-artifacts/4-5-inspect-and-explain-migration-outcomes.md`, `git log -n 5`]

### Git Intelligence Summary

Recent commits:

- `7c55563` migration outcomes
- `942dc7b` finishign review
- `3befc28` cleanup
- `19471fd` review
- `48dd230` reprojection

Actionable implication: focus 4.6 changes on coherence and contract clarity, not new migration mechanics.

### Library / Framework Requirements (Latest Check: 2026-05-05)

- `typescript`: `6.0.3`
- `vitest`: `4.1.5`
- `n3`: `2.0.3`
- `better-sqlite3`: `12.9.0`
- `tsup`: `8.5.1`

Use repository-pinned versions unless this story explicitly includes dependency upgrades.

### Testing Requirements

Required workflow-equivalent checks before completion:

- `npm run verify`
- `npm run build`
- `npm run test:demo`
- `npm run test:pod`

Suggested focused checks during implementation:

- `npx vitest tests/public-api.test.ts -t "migration|unsupported|sync state|evolution"`
- `npx vitest tests/demo-cli.test.ts -t "sync status|migration|task"`

### Project Structure Notes

Likely touchpoints:

- `docs/ADR.md`
- `docs/API.md`
- `docs/architecture.md`
- `README.md`
- `docs/QUICKSTART.md`
- `demo/README.md`
- `docs/WIP.md`
- `docs/PLANS.md`
- `tests/public-api.test.ts` (if behavior assertions are adjusted)
- `tests/demo-cli.test.ts` (if user-facing inspection wording changes)

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/ADR.md`
- `docs/API.md`
- `docs/architecture.md`
- `docs/PLANS.md`
- `docs/WIP.md`
- `README.md`
- `docs/QUICKSTART.md`
- `demo/README.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/4-4-migrate-supported-existing-data-without-data-loss.md`
- `_bmad-output/implementation-artifacts/4-5-inspect-and-explain-migration-outcomes.md`
- `https://www.npmjs.com/package/typescript`
- `https://www.npmjs.com/package/vitest`
- `https://www.npmjs.com/package/n3`
- `https://www.npmjs.com/package/better-sqlite3`
- `https://www.npmjs.com/package/tsup`

## Story Completion Status

- Story implementation completed with bounded evolution contract hardening and consistency updates across architecture, API, onboarding, and demo docs.
- Code review completed and patches applied. Status set to `done`; Epic 4 closed.
- Completion note: Story 4.6 completed with full validation gates (`verify`, `build`, `test:demo`, `test:pod`) passing.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Workflow customization resolved for `bmad-create-story`.
- Sprint status parsed and first backlog story selected in order (`4-6-keep-the-evolution-path-bounded-and-future-reuse-friendly`).
- Core docs, planning artifacts, project context, previous story context, and recent git history analyzed.
- Latest dependency versions checked from npm for implementation freshness.
- Story file created and sprint status transitioned to `ready-for-dev`.
- Story resumed through `bmad-dev-story`, and sprint status transitioned `ready-for-dev -> in-progress`.
- Updated bounded-evolution wording and scope constraints in `docs/ADR.md`, `docs/API.md`, `docs/architecture.md`, `docs/QUICKSTART.md`, `demo/README.md`, `README.md`, `docs/WIP.md`, and `docs/PLANS.md`.
- Added regression test coverage in `tests/demo-cli.test.ts` to verify sync status reports the latest local migration outcome entry.
- Ran `npx vitest tests/demo-cli.test.ts`, `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` successfully.

### Completion Notes List

- Consolidated 4.6 scope as a contract-hardening story rather than a new migration-mechanics story.
- Captured file-by-file guardrails for docs and API consistency work.
- Preserved strict bounded-scope constraints and future-backend portability framing.
- Included explicit verification gates and focused test suggestions.
- Clarified in accepted docs that Phase 1 evolution support is bounded, explicit, and inspectable, not general-purpose schema evolution.
- Strengthened architecture language to separate core semantic guarantees from Solid-specific transport details while keeping backend portability direction explicit.
- Added Quick Start and demo scope notes to prevent accidental over-claims in onboarding material.
- Added demo CLI regression coverage for the "latest migration outcome" sync-state behavior used by docs.

### File List

- README.md
- _bmad-output/implementation-artifacts/4-6-keep-the-evolution-path-bounded-and-future-reuse-friendly.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- demo/README.md
- docs/ADR.md
- docs/API.md
- docs/PLANS.md
- docs/QUICKSTART.md
- docs/WIP.md
- docs/architecture.md
- tests/demo-cli.test.ts

## Change Log

- 2026-05-05: Created Story 4.6 implementation context and advanced sprint status to `ready-for-dev`.
- 2026-05-05: Implemented Story 4.6 bounded-evolution contract hardening, added migration-outcome sync-status regression coverage, passed verify/build/demo/pod checks, and advanced story to `review`.
- 2026-09-26: Code review completed; tightened latest-outcome regression test, consolidated duplicated scope disclaimers into links to the API contract, and advanced story to `done`.
