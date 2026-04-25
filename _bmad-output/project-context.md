---
project_name: "lofipod"
user_name: "Michał"
date: "2026-04-25"
sections_completed:
  - technology_stack
  - language_specific_rules
  - framework_specific_rules
  - testing_rules
  - code_quality_style_rules
  - development_workflow_rules
  - critical_dont_miss_rules
status: "complete"
rule_count: 72
optimized_for_llm: true
existing_patterns_found: 10
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Package: `lofipod@0.2.1`
- Language: TypeScript `^6.0.3`
- Runtime target for development and CI: Node.js `>=24`
- Package model: ESM package with dual ESM/CJS published outputs via the export map
- Build tooling: `tsup@^8.3.5` for JS bundles, `tsc` for declaration output
- TypeScript constraints: `strict: true`, `target: "ES2022"`, `moduleResolution: "Bundler"`, `verbatimModuleSyntax: true`, `isolatedModules: true`
- Test runner: `vitest@^4.1.4`
- Linting and formatting: ESLint 10, `typescript-eslint` 8, Prettier 3
- RDF and Pod interoperability layer: `n3@^2.0.3` plus project-specific Solid adapter code
- Storage/runtime adapters:
  - core: in-memory storage and framework-agnostic engine
  - browser entrypoint: IndexedDB adapter
  - node entrypoint: SQLite adapter via `better-sqlite3@^12.8.0` and Solid adapter support
- Public packaging boundary:
  - `lofipod` must remain environment-neutral and framework-agnostic
  - `lofipod/browser` is the browser-only surface
  - `lofipod/node` is the Node-only surface
- Packaging implication for agents: do not pull browser APIs, SQLite/native deps, or Solid runtime specifics into the root core entrypoint

## Critical Implementation Rules

### Language-Specific Rules

- Keep the codebase in strict TypeScript. Do not weaken compiler guarantees with `any`, broad casts, unsafe assertions, or suppression comments unless a documented boundary case requires it.
- Use ESM imports/exports consistently, including `.js` specifiers in local TypeScript source imports.
- Prefer `import type` for type-only dependencies.
- Preserve package boundaries: the root package must remain environment-neutral, and core code must not import or re-export browser-only or Node-only modules or reach into adapter-specific entrypoints.
- Extend the public type surface deliberately. Route new exported types through the established public boundary instead of leaking internal storage, sync, RDF, or helper shapes ad hoc.
- Treat `defineEntity(...)` definitions as persistence and sync contracts. Keep identity, storage placement, RDF mapping, and projection behavior explicit, validated at the API boundary, and semantically stable.
- Treat `toRdf(...)` as pure canonical projection logic. It should deterministically describe the full entity graph from input data alone.
- Treat `project(...)` as pure rehydration logic. It should rebuild application objects from canonical graph state without hidden side effects, I/O, or ambient dependencies.
- Prefer typed RDF terms and existing helper abstractions at RDF-facing boundaries. Only use scalar shortcuts where the existing helper contract explicitly defines that conversion.
- Preserve the distinction between public triples and attached internal triples in RDF helpers; do not collapse this into lossy plain-object serialization.
- Do not add silent fallback behavior that weakens API contracts. Invalid usage should usually fail explicitly.
- Follow the existing async API shape: public APIs return promises, orchestration uses `async`/`await`, and intentionally non-blocking background work must make failure handling explicit.
- Do not introduce default exports, CommonJS syntax, or mixed module conventions.
- When changing public types, signatures, or exported behavior, keep `docs/API.md` and public-API-focused tests aligned with the new contract.

### Framework-Specific Rules

- Treat the core as intentionally framework-agnostic. Do not introduce React hooks, component assumptions, UI lifecycle logic, or framework-specific state patterns into shared engine code.
- If future framework bindings are needed, keep them in separate public packages or entrypoints rather than folding them into the core package.

### Testing Rules

- Prefer behavior-focused tests through supported public entrypoints before testing internal helpers directly.
- For bug fixes, API changes, and persistence or sync changes, add or update a failing test first when practical.
- Prefer `lofipod`, `lofipod/node`, and `lofipod/browser` entrypoints over deep internal imports unless the behavior cannot be expressed through the public surface.
- Use `npm test` as the default fast regression gate during development.
- Use mocks or fakes by default for unit and most sync-path tests, while keeping protocol and RDF data shapes realistic when behavior depends on them.
- Keep real interoperability tests small and deliberate, limited to focused checks against Community Solid Server.
- When changing persistence or sync behavior, prioritize tests for retries, failures, recovery, bootstrap, idempotency, canonical reconciliation, and branch or conflict handling.
- Keep tests TypeScript-first and public-API-first; avoid coupling tests to internals when supported APIs can verify the same behavior.
- Coverage thresholds are minimum safety rails, not a substitute for meaningful behavior assertions: statements `80`, branches `60`, functions `85`, lines `80`.
- Entry-point shims such as `src/index.ts`, `src/node.ts`, and `src/browser.ts` are excluded from coverage thresholds, but changes to their exported behavior should still be validated through public-entrypoint tests.
- Use `npm run test:demo` for end-to-end CLI regression checks.
- Use `npm run test:pod` for real Pod-backed checks and keep that suite focused.
- For substantive changes, run `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` when the environment allows; if a check cannot run locally, say so explicitly.

### Code Quality & Style Rules

- Keep the core framework-agnostic; do not introduce React or other UI-framework assumptions into engine, RDF, storage, or sync code.
- Preserve package and entrypoint boundaries: keep shared logic portable, and avoid pulling browser-only or Node-only concerns across `lofipod`, `lofipod/browser`, and `lofipod/node`.
- Treat `docs/ADR.md` as the source of accepted architectural constraints; do not leave material design, storage, or sync changes implicit in code alone.
- Keep `docs/PLANS.md` focused on small, independently testable, API-first delivery slices, and keep `docs/WIP.md` factual and current during active work without treating either file as long-term architectural authority.
- Do not treat `docs/PLANS.md` or `docs/WIP.md` as authoritative when they conflict with `docs/ADR.md` or the implemented public API.
- Prefer small, composable modules with clear responsibilities over large mixed-concern files.
- Follow existing naming and layout conventions by default, and colocate new code with the subsystem it extends; introduce new top-level structure only when the current layout no longer fits cleanly.
- Respect public export boundaries. Prefer extending supported entrypoints over creating new deep-import surfaces, and keep internal modules internal unless an API change is intentional and documented.
- Preserve strict TypeScript intent: avoid `any`, avoid weakening types to bypass the compiler, and prefer explicit domain types over loose object shapes.
- Use runtime validation at external, persistence, network, and public API boundaries; avoid redundant validation deep inside internal flows once invariants are established.
- Keep projection and serialization paths deterministic and side-effect free where the design expects pure transforms.
- Keep comments and docs concise and durable; document invariants, non-obvious constraints, and edge cases rather than obvious mechanics likely to drift.
- Follow the repository's enforced formatting and linting rules, including semicolons, double quotes, and `_`-prefixed intentionally unused variables.
- Keep the project scoped to its current purpose: local-first transaction log plus materialized model with SOLID Pod synchronization, not a general RDF database, generic CRDT framework, or UI state library.
- When public API, architecture, storage/sync behavior, or developer workflow changes materially, update the affected docs in the same change, especially `docs/API.md`, `docs/ADR.md`, `docs/PLANS.md`, and `docs/WIP.md`.

### Development Workflow Rules

- Read `README.md`, `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, and `docs/WIP.md` before substantive changes.
- Treat `docs/ADR.md` as accepted architecture, `docs/API.md` as the public API draft, `docs/PLANS.md` as delivery slicing guidance, and `docs/WIP.md` as active factual memory.
- Structure work as small, independently testable, API-first slices instead of large mixed changes.
- Keep `docs/WIP.md` current during active implementation, but do not use it as a substitute for updating durable docs when decisions are accepted.
- Before finishing substantive changes, run `npm run verify`, `npm run build`, `npm run test:demo`, and `npm run test:pod` when the environment allows.
- If local environment limits prevent one of the expected checks from running, say so explicitly in the handoff.

### Critical Don't-Miss Rules

- Do not break the framework-agnostic root package by importing browser APIs, SQLite/native Node dependencies, or Solid runtime specifics into shared core modules.
- Do not bypass supported public entrypoints by creating new deep-import dependency paths as a convenience.
- Do not weaken strict TypeScript guarantees with `any`, broad assertions, or suppression comments unless there is a documented boundary reason.
- Do not make `toRdf(...)`, `project(...)`, projection, or serialization paths depend on ambient state or hidden side effects.
- Do not replace behavior-focused tests with coverage-chasing or brittle internal-only assertions.
- Do not add silent fallback behavior that weakens API or sync contracts.
- Do not treat `docs/PLANS.md` or `docs/WIP.md` as accepted architecture when `docs/ADR.md` says otherwise.
- Do not expand narrow repository features into generic framework abstractions unless that direction is explicitly accepted in `docs/ADR.md`.
- Do not leave material API, architecture, storage/sync, or workflow changes undocumented in the matching docs.
- Do not finish substantive changes without attempting the workflow-equivalent checks, and if environment limits block them, say so explicitly.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing substantive code changes.
- Prefer the more restrictive interpretation when multiple docs seem compatible.
- Follow package boundaries, purity expectations, and testing rules before optimizing for convenience.
- Update this file when stable project patterns or constraints change.

**For Humans:**

- Keep this file lean and focused on unobvious agent-facing rules.
- Update it when the technology stack, package boundaries, or workflow expectations change.
- Remove rules that become redundant or obvious over time.
- Keep it aligned with `docs/ADR.md`, `docs/API.md`, `docs/PLANS.md`, and `docs/WIP.md`.

Last Updated: 2026-04-25
