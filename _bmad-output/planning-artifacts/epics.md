---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - /media/michal/data/code/lofipod/_bmad-output/planning-artifacts/prd.md
  - /media/michal/data/code/lofipod/docs/architecture.md
  - /media/michal/data/code/lofipod/docs/ADR.md
  - /media/michal/data/code/lofipod/docs/API.md
  - /media/michal/data/code/lofipod/README.md
  - /media/michal/data/code/lofipod/docs/PLANS.md
  - /media/michal/data/code/lofipod/docs/WIP.md
  - /media/michal/data/code/lofipod/_bmad-output/project-context.md
---

# lofipod - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for lofipod, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Developers can install lofipod in a TypeScript project using the supported package distribution.
FR2: Developers can use lofipod from JavaScript as well as TypeScript.
FR3: Developers can initialize lofipod for a local-first application without first configuring remote sync.
FR4: Developers can connect an application using lofipod to a user's Solid Pod.
FR5: Developers can follow official documentation to create a working bounded-app example using the public API.
FR6: Developers can define shallow entity types for application data.
FR7: Applications can create new entities locally.
FR8: Applications can read previously stored entities locally.
FR9: Applications can update existing entities locally.
FR10: Applications can delete entities locally.
FR11: Applications can list collections of stored entities locally.
FR12: Applications can work with deterministic entity identity within the supported bounded app class.
FR13: Applications can perform CRUD operations without requiring direct developer management of sync workflows.
FR14: Applications can store and retrieve entity data using the documented public API only.
FR15: Applications can persist entity data locally for offline-first use.
FR16: Applications can continue reading and writing supported data while disconnected from the network.
FR17: Applications can reopen previously stored local data after application restart.
FR18: Developers can inspect locally stored application data.
FR19: Developers can inspect the local state relevant to synchronization and migration behavior.
FR20: Applications can attach Pod-backed synchronization to locally managed data.
FR21: lofipod can synchronize supported entity changes to the connected Solid Pod in the background.
FR22: lofipod can import supported Pod-backed data into the local application state.
FR23: Applications can continue normal local operation while background synchronization occurs.
FR24: lofipod can resume synchronization after temporary offline periods.
FR25: lofipod can bring multiple devices using the same application toward a consistent state for supported scenarios.
FR26: Developers can inspect the canonical Pod-side data produced by lofipod.
FR27: lofipod can keep Pod-backed data visible in a reusable RDF form rather than only as app-private state.
FR28: Developers can evolve the supported entity model over time.
FR29: lofipod can read data created by an older supported schema version.
FR30: lofipod can migrate supported existing data to a newer schema version without data loss in supported scenarios.
FR31: lofipod can preserve synchronization trust when supported schema evolution occurs.
FR32: Developers can inspect the result of schema migration in local state and Pod-backed state.
FR33: lofipod can detect a predefined class of out-of-band Pod-side changes affecting supported data.
FR34: lofipod can classify whether a detected Pod-side change is safe to import within the supported Phase 1 model.
FR35: lofipod can safely import Pod-side changes that match the supported entity shape and invariants.
FR36: lofipod can surface Pod-side changes that are unsupported, ambiguous, or unsafe to merge.
FR37: lofipod can apply a documented policy response to unsupported or unsafe Pod-side changes.
FR38: Developers can inspect what foreign change was detected and how lofipod responded to it.
FR39: lofipod does not require Phase 1 support for arbitrary Pod-side writers or arbitrary RDF mutations.
FR40: Developers can inspect logs relevant to local-first state, synchronization activity, and migration behavior.
FR41: Developers can determine what changed locally, what synchronized, and what did not synchronize.
FR42: Developers can determine whether a supported migration occurred and what outcome it produced.
FR43: Developers can determine whether a foreign Pod-side change was imported, rejected, quarantined, or otherwise surfaced by policy.
FR44: Developers can diagnose supported synchronization interruptions using documented inspection paths.
FR45: Developers can distinguish between local state, Pod-backed state, and synchronization-related state during troubleshooting.
FR46: Developers can inspect application data in the connected Solid Pod outside the originating application.
FR47: Developers can rely on lofipod to keep canonical Pod-backed data in a form intended for reuse.
FR48: Developers can build the bounded Phase 1 app class without coupling to hidden internals.
FR49: Developers can use the same documented capability model across Node and browser environments.
FR50: The product can grow later toward broader cross-application reuse without redefining the core Phase 1 capability contract.

### NonFunctional Requirements

NFR1: Local CRUD interactions for the supported bounded app class must not be blocked by background synchronization activity.
NFR2: Normal local reads and writes for the supported personal-data app size must feel immediate and lag-free during ordinary use.
NFR3: Synchronization work must remain hidden in the background during supported local interaction rather than becoming a foreground interaction cost.
NFR4: Data becoming available from synchronization should appear incrementally as it is safely incorporated, rather than requiring all synchronization work to complete before any usable state is visible.
NFR5: The system must not lose user data in supported scenarios.
NFR6: For the supported bounded model, multiple devices must converge to a consistent state after offline/reconnect behavior completes.
NFR7: The supported conflict model must be CRDT-light, with automatic conflict resolution required within the documented constraints of simple ordered collections of entities and unordered sets of entities, without claiming general CRDT semantics outside those boundaries.
NFR8: Supported conflicts must resolve automatically and predictably within the documented model constraints.
NFR9: When a conflict or state condition falls outside supported automatic resolution boundaries, the system must surface that condition explicitly rather than silently corrupting or discarding data.
NFR10: Schema migration failures or partial migration conditions must be explicit and inspectable rather than hidden.
NFR11: Synchronization interruptions must be recoverable without requiring the user to abandon local-first use.
NFR12: lofipod must not depend on centralized telemetry or centralized data collection for normal operation.
NFR13: Credentials, access tokens, and equivalent Pod access secrets must be protected from exposure through normal logs, diagnostics, and user-visible inspection paths.
NFR14: Diagnostics must avoid exposing private user content by default unless the developer or user explicitly chooses to export or reveal it.
NFR15: The system must preserve the principle that user data remains under user-controlled storage boundaries rather than being silently replicated to centralized service infrastructure.
NFR16: Intermittent internet connectivity must not prevent continued supported local use of the application.
NFR17: Loss of Pod availability or temporary network failure must degrade to continued local-first behavior rather than application failure.
NFR18: When Pod access, authentication, or network conditions prevent synchronization, the system must surface that condition clearly enough for a developer to diagnose it.
NFR19: Canonical Pod-backed RDF data must remain inspectable by developers and compatible with the documented bounded model.
NFR20: Integration with Pods must tolerate ordinary variability in network and Pod responsiveness without invalidating the local-first user experience.
NFR21: The root package must remain framework-agnostic and must not introduce React or other UI-framework assumptions into engine or core RDF/storage code.
NFR22: The top-level `lofipod` entrypoint must remain environment-neutral, with browser-only and Node-only capabilities isolated behind `lofipod/browser` and `lofipod/node`.
NFR23: The public API must remain intentionally small, explicit, and stable enough to support a `1.0` release with effectively zero breaking changes afterward except in exceptional cases.
NFR24: Documentation and examples must stay aligned with public API changes so the documented path remains trustworthy.
NFR25: Reliability-focused verification must remain part of the delivery bar, including behavior-focused tests, mocked sync coverage, focused real Pod integration checks, and the workflow-equivalent verification commands.

### Additional Requirements

- Use `docs/architecture.md` as the current architectural baseline where it is newer than `docs/ADR.md` or `docs/API.md`, while preserving any still-valid constraints from those older documents.
- Keep the core package framework-agnostic and environment-neutral, with browser and Node adapters exposed only through their dedicated public entrypoints.
- Preserve the intentionally small public surface centered on `defineVocabulary(...)`, `defineEntity<T>(...)`, `createEngine(...)`, CRUD operations, sync lifecycle methods, and RDF helper exports.
- Treat entity definitions as the contract across application objects, local persistence, and canonical Pod resources, with deterministic identity and explicit RDF projection and rehydration hooks.
- Maintain the layered local-first architecture: definition/RDF helpers, local engine and storage, sync orchestration, and Solid Pod transport/serialization.
- Keep sync work serialized and background-oriented so local writes commit first and remote work remains additive rather than blocking CRUD.
- Preserve the local persistence model of stored canonical graphs, projected read models, append-only graph-delta history, and sync metadata.
- Keep canonical Pod resources as Turtle files under per-entity directories and replication logs as N-Triples entries for deterministic parsing and replay.
- Treat SOLID Pods as durable backing store and sync target, not the primary application query engine; application-facing reads and lists must remain local-first.
- Preserve shallow-entity scope and bounded conflict semantics rather than expanding Phase 1 toward deep graph merges, arbitrary collaborative editing, or generic RDF database behavior.
- Support explicit bootstrap import, reconciliation, canonical polling, and branch handling as part of the sync architecture for trust and recovery.
- Keep diagnostics, inspectability, and explainability as first-class implementation concerns across local state, sync state, migration outcomes, and foreign-change policy handling.
- Preserve JavaScript consumption support alongside first-class TypeScript ergonomics.
- Maintain packaging and release expectations around npm installation, export-map boundaries, and CI gates covering verify, build, demo regression, and focused Pod integration tests.
- Favor documentation as a product feature: README, Quickstart, tutorial/example coverage, and API-aligned docs must remain part of deliverable scope, not post-hoc support work.
- Keep the remote sync architecture flexible enough to support additional user-controlled storage backends in the future, such as personal cloud storage providers, without redefining the local-first core or binding the engine exclusively to Solid Pods.
- Document Solid Pods as the first implemented remote synchronization target while noting alternative personal-storage-backed sync as a future architectural direction rather than current scope.

### UX Design Requirements

UX-DR1: The project must provide a clear public-facing entry surface for developers, centered on the GitHub repository README and optionally a simple static project page, that explains the problem, value proposition, and product scope quickly.
UX-DR2: The first-contact developer experience must make local-first plus Pod-backed sync feel practical rather than academic, using concise explanation before deep implementation detail.
UX-DR3: The onboarding experience must guide a developer from zero to first proof of value quickly through an understandable Quickstart and bounded end-to-end example.
UX-DR4: The public API must feel simple, coherent, and understandable to developers, with entities, local-first CRUD, and attachable sync presented as the main mental model.
UX-DR5: The API and examples must be difficult to misuse by both human developers and LLM-assisted builders, with explicit constraints and stable conventions.
UX-DR6: Documentation must explain the conceptual model clearly, including the distinction between local state, canonical Pod data, and background synchronization.
UX-DR7: Developer-facing explanations must make the supported scope and exclusions explicit so builders understand what the library is for and what it intentionally does not optimize for.
UX-DR8: Public documentation and examples must remain closely aligned with the actual stable API so developers can trust what they read.
UX-DR9: The package surface and entrypoints must be presented in a way that is easy to navigate, clearly separating `lofipod`, `lofipod/browser`, and `lofipod/node`.
UX-DR10: The overall developer experience must emphasize clarity, functional usefulness, simplicity, stability, and trustworthiness as user-facing product qualities.

### FR Coverage Map

FR1: Epic 1 - install in TypeScript project
FR2: Epic 1 - JavaScript consumption
FR3: Epic 1 - initialize for local-first use without remote sync
FR4: Epic 2 - connect an application to a user's Solid Pod
FR5: Epic 1, Epic 5 - documentation supports a working bounded-app example
FR6: Epic 1 - define shallow entity types
FR7: Epic 1 - create entities locally
FR8: Epic 1 - read entities locally
FR9: Epic 1 - update entities locally
FR10: Epic 1 - delete entities locally
FR11: Epic 1 - list local entity collections
FR12: Epic 1 - deterministic entity identity
FR13: Epic 2, Epic 5 - CRUD without sync workflow micromanagement
FR14: Epic 1, Epic 5 - use documented public API only
FR15: Epic 1 - persist entity data locally
FR16: Epic 1 - continue local use while offline
FR17: Epic 1 - reopen previously stored local data after restart
FR18: Epic 1 - inspect locally stored application data
FR19: Epic 3 - inspect local state relevant to sync and migration
FR20: Epic 2 - attach Pod-backed synchronization
FR21: Epic 2 - synchronize supported changes to the Pod in the background
FR22: Epic 2 - import Pod-backed data into local application state
FR23: Epic 2 - continue normal local operation during sync
FR24: Epic 2 - resume synchronization after temporary offline periods
FR25: Epic 2 - converge toward consistent multi-device state in supported scenarios
FR26: Epic 2 - inspect canonical Pod-side data
FR27: Epic 2, Epic 4 - keep canonical Pod data reusable and visible as RDF
FR28: Epic 4 - evolve the supported entity model over time
FR29: Epic 4 - read data created by an older supported schema version
FR30: Epic 4 - migrate supported existing data safely to a newer schema version
FR31: Epic 4 - preserve synchronization trust during schema evolution
FR32: Epic 4 - inspect schema migration results in local and Pod-backed state
FR33: Epic 3 - detect a predefined class of out-of-band Pod-side changes
FR34: Epic 3 - classify whether a detected Pod-side change is safe to import
FR35: Epic 3 - safely import supported Pod-side changes
FR36: Epic 3 - surface unsupported, ambiguous, or unsafe Pod-side changes
FR37: Epic 3 - apply documented policy responses to unsupported or unsafe changes
FR38: Epic 3 - inspect what foreign change was detected and how lofipod responded
FR39: Epic 4 - preserve bounded Phase 1 scope rather than support arbitrary writers or arbitrary RDF mutations
FR40: Epic 3, Epic 5 - inspect logs and explanations for local, sync, and migration behavior
FR41: Epic 3 - determine what changed locally, what synchronized, and what did not
FR42: Epic 4 - determine whether a supported migration occurred and its outcome
FR43: Epic 3 - determine how a foreign Pod-side change was handled
FR44: Epic 3 - diagnose supported synchronization interruptions
FR45: Epic 3 - distinguish local state, Pod-backed state, and sync-related state
FR46: Epic 2, Epic 4 - inspect application data in the Pod outside the originating app
FR47: Epic 2, Epic 4 - rely on canonical Pod-backed data intended for reuse
FR48: Epic 5 - build the bounded app class without coupling to hidden internals
FR49: Epic 2, Epic 5 - use the same documented capability model across Node and browser
FR50: Epic 4, Epic 5 - grow toward broader cross-application reuse without redefining the Phase 1 capability contract

## Epic List

### Epic 1: Fast First Local-First Success

Developers can install lofipod, understand the core mental model, define shallow entities, persist data locally, and reach a fast first proof of value through clear API ergonomics and onboarding documentation.
**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR14, FR15, FR16, FR17, FR18

### Epic 2: Background Pod Sync Without Sync Choreography

Developers can attach a Solid Pod and gain background synchronization, canonical Pod visibility, and multi-device consistency without changing the local-first programming model or manually orchestrating sync flows.
**FRs covered:** FR4, FR13, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR46, FR47, FR49

### Epic 3: Trust, Recovery, and Explainability Under Failure

Developers can trust lofipod in real-world failure conditions because sync interruptions, foreign changes, retries, and recovery behavior are visible, diagnosable, and handled predictably within the supported model.
**FRs covered:** FR19, FR33, FR34, FR35, FR36, FR37, FR38, FR40, FR41, FR43, FR44, FR45

### Epic 4: Safe Evolution of Data and Application Semantics

Developers can change their application model over time, preserve trust in existing data, and retain portable canonical semantics that support future reuse without data loss in supported scenarios.
**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR39, FR42, FR46, FR47, FR50

### Epic 5: Adoption Hardening for Teams and LLM-Assisted Builders

Developers and teams can evaluate, adopt, and keep using lofipod confidently through strong public docs, reference guidance, stable examples, compatibility clarity, and a product surface that stays understandable without hidden internals.
**FRs covered:** FR5, FR13, FR14, FR40, FR48, FR49, FR50

Note: Epic 5 is intentionally deferred follow-up work and is not part of the current story-generation scope for the initial approved plan.

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic {{N}}: {{epic_title_N}}

{{epic_goal_N}}

## Epic 1: Fast First Local-First Success

Developers can install lofipod, understand the core mental model, define shallow entities, persist data locally, and reach a fast first proof of value through clear API ergonomics and onboarding documentation.

### Story 1.1: Explain the Local-First Promise and First-Run Path

As a developer evaluating lofipod,
I want a clear first-contact explanation and setup path,
So that I can understand what the library does and how to start without reading internals.

**Acceptance Criteria:**

**Given** a developer arrives at the `lofipod` repository for the first time
**When** they read the primary entry surface
**Then** it explains the problem `lofipod` solves, the bounded app class it targets, and the local-first plus Pod-backed mental model in plain language
**And** it states clearly what is intentionally out of scope

**Given** a developer wants to try `lofipod` without setting up Pod sync first
**When** they follow the first-run path in the repository documentation
**Then** they are directed to a simple in-repo todo demo that proves local-first value before remote sync
**And** the path does not require reading internal source files to understand the workflow

**Given** a developer is deciding how to start coding with `lofipod`
**When** they review the first-run documentation
**Then** it shows the supported package entrypoints and distinguishes `lofipod`, `lofipod/browser`, and `lofipod/node` correctly
**And** it keeps the framework-agnostic core boundary clear

**Given** a developer wants to know the minimum supported workflow
**When** they read the getting-started guidance
**Then** it describes the sequence of defining an entity, creating an engine, performing local CRUD, and using the in-repo todo demo as the first proof of value
**And** it does not require Pod connection for this initial path

**Given** a developer or LLM-assisted builder follows the documented first-contact path
**When** they complete the setup steps for the initial local-only experience
**Then** they can identify the exact files, commands, and documented next step needed to run or inspect the todo demo
**And** the instructions are consistent with the actual repository layout and public API

### Story 1.2: Define a Todo Entity Through the Local Public API

As a developer building a simple demo app,
I want to define a todo entity for local-first behavior without designing an ontology first,
So that I can model a realistic bounded example quickly through supported APIs.

**Acceptance Criteria:**

**Given** a developer is following the in-repo todo demo path
**When** they define the first application entity
**Then** the example uses a todo entity with shallow fields appropriate to the supported Phase 1 model
**And** it avoids unsupported deep graph or arbitrary collaborative structures

**Given** a developer defines the todo entity for the local-first demo
**When** they use the public API
**Then** they do so through the supported entity-definition surface rather than internal modules
**And** the example makes the entity kind and identity rule explicit without requiring Pod-specific mapping at this stage

**Given** a developer is completing the quick-start local workflow
**When** they read the example and its surrounding explanation
**Then** they can understand how the todo entity participates in local save, read, update, delete, and list behavior
**And** they are not required to learn RDF or choose ontology terms before reaching first proof of value

**Given** canonical Pod mapping is a later concern
**When** the developer finishes this story
**Then** the local-first entity definition is ready to support later sync-related mapping work
**And** the design leaves a clear extension point for adding ontology and canonical RDF behavior in Epic 2

**Given** a developer or LLM-assisted builder wants to reuse the todo pattern
**When** they inspect the completed story outcome
**Then** they can identify the minimum supported pattern for defining one bounded local-first entity in `lofipod`
**And** the example is small enough to serve as a reliable starting point for later sync stories in the demo

### Story 1.3: Build Local CRUD for the In-Repo Todo Demo

As a developer validating lofipod,
I want the demo todo app to create, read, update, delete, and list todos locally,
So that the library proves useful before sync is introduced.

**Acceptance Criteria:**

**Given** the todo entity is defined through the public API
**When** a developer runs the in-repo demo in local-only mode
**Then** they can create a todo item through the documented workflow
**And** the created item is immediately available through the local read path

**Given** one or more todo items already exist locally
**When** the developer reads or lists todos through the demo
**Then** the results come from the local-first engine behavior rather than any remote dependency
**And** the output reflects the current local state consistently

**Given** an existing todo item is stored locally
**When** the developer updates one or more supported fields
**Then** the updated values are returned by subsequent local reads and lists
**And** the workflow remains entirely within the supported public API surface

**Given** an existing todo item is stored locally
**When** the developer deletes that item through the demo workflow
**Then** it is no longer returned by local reads or lists
**And** the deletion behavior is observable through the documented demo path

**Given** a developer is using the todo demo as the first proof of value
**When** they inspect the example and its supporting documentation
**Then** they can see a complete local CRUD flow that is small, understandable, and framework-agnostic
**And** the demo does not require Pod setup, background sync, or internal implementation knowledge

### Story 1.4: Persist the Todo Demo Across Restart

As a developer testing real local-first behavior,
I want the demo todo app’s local state to survive restart,
So that the first demonstration reflects real day-to-day use rather than an in-memory toy.

**Acceptance Criteria:**

**Given** a developer has created one or more todo items through the in-repo demo
**When** they stop and restart the demo using the documented local persistence path
**Then** the previously stored todo items are still available
**And** the restored data can be read and listed through the same documented workflow

**Given** the demo is intended as the first real proof of local-first usefulness
**When** local persistence is configured for the demo
**Then** it uses a supported storage approach appropriate to the runtime being demonstrated
**And** it does not require any remote service or Pod connection to preserve state

**Given** a developer updates or deletes todo items before restarting the demo
**When** the application is started again
**Then** the post-restart state reflects the latest successful local operations
**And** the persisted result is consistent with the local-first API behavior already demonstrated in earlier stories

**Given** a developer is trying to understand what “local-first” means in practice
**When** they review the demo and its supporting guidance
**Then** they can see clearly that local durability is part of the supported workflow
**And** the persistence setup remains small enough to understand without reading internal implementation details

**Given** the todo demo is used as an in-repo validation harness
**When** the persistence story is complete
**Then** the repository contains a repeatable way to demonstrate restart-safe local state for the simple todo app
**And** that proof remains aligned with the documented public API

### Story 1.5: Verify and Document the Todo Demo as the First Proof of Value

As a developer deciding whether to adopt lofipod,
I want a tested, documented todo demo in the repository,
So that I can run it, inspect local state, and confirm the claimed developer workflow actually works.

**Acceptance Criteria:**

**Given** the in-repo todo demo supports local entity definition, CRUD, and restart-safe persistence
**When** a developer follows the documented demo workflow
**Then** they can run the demo successfully as the primary first proof of value for lofipod
**And** the documented steps match the actual repository behavior

**Given** the todo demo is meant to validate the early product promise
**When** the repository test and demo strategy is reviewed
**Then** there is an explicit, repeatable way to verify the demo behavior
**And** the verification approach is consistent with the project’s reliability-first testing stance

**Given** a developer wants to inspect what the demo proved
**When** they review the supporting documentation
**Then** it explains what capabilities the demo covers, what remains intentionally out of scope at this stage, and what the next logical step is
**And** it makes clear that Pod sync is not required for the first validation path

**Given** a developer or LLM-assisted builder wants to use the demo as a reference implementation
**When** they inspect the code and documentation together
**Then** they can understand how the demo maps to the public API and the local-first mental model
**And** they can identify which parts are library behavior versus demo-specific scaffolding

**Given** Epic 1 is considered complete
**When** the todo demo, docs, and validation path are reviewed together
**Then** the repository demonstrates a coherent first-use experience that is simple, understandable, and trustworthy
**And** it provides a stable baseline for the later sync-focused epics

## Epic 2: Background Pod Sync Without Sync Choreography

Developers can attach a Solid Pod and gain background synchronization, canonical Pod visibility, and multi-device consistency without changing the local-first programming model or manually orchestrating sync flows.

### Story 2.1: Attach Pod Sync to the Todo Demo Without Changing Local CRUD

As a developer extending the in-repo todo demo,
I want to attach Pod-backed sync to the existing local-first app,
So that remote durability is additive rather than a rewrite.

**Acceptance Criteria:**

**Given** the in-repo todo demo already works locally without Pod sync
**When** a developer enables sync for the demo through the supported configuration path
**Then** the same local CRUD workflow continues to work through the public API
**And** the developer is not required to redesign the app around remote-first concepts

**Given** a developer wants to add Pod-backed behavior to the existing demo
**When** they follow the documented sync-attachment path
**Then** the setup makes clear which configuration belongs to the core engine and which runtime-specific adapter belongs to the browser or Node entrypoint
**And** the framework-agnostic boundary of the root package remains intact

**Given** sync is attached to the todo demo
**When** a local save or delete operation completes
**Then** the local operation succeeds on the local-first path before remote synchronization work is attempted
**And** sync is treated as background behavior rather than a prerequisite for CRUD success

**Given** a developer is evaluating whether sync is additive or invasive
**When** they compare the local-only demo flow with the sync-enabled flow
**Then** the application-facing programming model remains substantially the same
**And** the new sync behavior is introduced as an attachment rather than a replacement for the local workflow

**Given** a developer or LLM-assisted builder is using the demo as the reference path
**When** they inspect the sync-enabled setup
**Then** they can identify the minimum supported pattern for attaching Pod sync to an existing local-first app
**And** the example is small enough to support the later sync stories without hidden glue code

### Story 2.2: Add Todo Ontology Mapping and Project Canonical Pod Resources

As a developer connecting the todo demo to a Solid Pod,
I want to add ontology-backed canonical mapping when sync is introduced,
So that local todo changes can become reusable Pod data without making ontology design a quick-start prerequisite.

**Acceptance Criteria:**

**Given** the todo demo already works locally and Pod sync is being introduced
**When** the developer adds canonical mapping for the todo entity
**Then** the mapping defines the RDF type, predicates, and Pod placement needed for canonical Pod storage
**And** this mapping step is introduced as part of Pod sync rather than as a requirement of the initial local-first walkthrough

**Given** Pod sync is attached to the sync-enabled todo demo
**When** a developer creates or updates a todo locally
**Then** the local operation completes through the normal local-first workflow
**And** the corresponding canonical Pod resource is updated in the background using the configured ontology-backed mapping

**Given** a todo exists in the sync-enabled demo
**When** the developer deletes it locally
**Then** the canonical Pod-side representation is removed or updated according to the supported deletion semantics
**And** the remote effect remains consistent with the documented bounded model

**Given** local todo changes are projected to the Pod
**When** a developer inspects the remote result
**Then** the canonical data is represented in the documented RDF form intended for reuse
**And** it is not hidden only inside app-private storage structures

**Given** the todo demo is the reference implementation for early sync behavior
**When** a developer reviews the code and documentation for this story
**Then** they can see clearly where local-first entity definition ends and canonical Pod mapping begins
**And** the explanation keeps ontology work understandable and scoped to the sync use case rather than the initial quick-start path

### Story 2.3: Import Pod-Backed Todo Data Into Fresh Local State

As a developer using the same todo data across devices,
I want the app to pull supported Pod-backed data into fresh local state,
So that a new local instance can recover and use the same dataset.

**Acceptance Criteria:**

**Given** canonical todo data already exists in the remote sync target for the demo
**When** a developer starts a fresh local instance of the sync-enabled todo app
**Then** the app can import the supported remote todo data into local state
**And** the recovered todos become available through the same local read and list workflow as locally created data

**Given** the initial quick-start path did not require ontology work
**When** the developer reaches remote import behavior
**Then** the documentation explains how canonical mapping now enables remote recovery and reuse
**And** the relationship between local entities and canonical remote data remains understandable

**Given** the sync-enabled demo is used on a second device or fresh local state
**When** background sync or explicit initial recovery runs through the supported path
**Then** the local app regains the current supported todo dataset without requiring manual reconstruction by the developer
**And** the resulting local state is consistent with the canonical remote representation

**Given** remote data includes supported todo items created elsewhere through the same documented model
**When** those items are imported into local state
**Then** they are projected into the normal local application shape
**And** the app continues to treat the local read model as the primary operational surface

**Given** the demo is proving the first remote recovery path
**When** a developer reviews the story outcome
**Then** they can see a clear, repeatable way for a new local instance to recover from canonical remote data
**And** the example remains small enough to understand without deep knowledge of internal sync machinery

### Story 2.4: Handle First Attach When Local and Remote Todo Data Both Exist

As a developer connecting an existing local app to an existing Solid Pod,
I want first attach to handle local and remote todo data safely,
So that I do not lose data or silently overwrite conflicting state.

**Acceptance Criteria:**

**Given** a local todo dataset already exists and supported canonical remote todo data also already exists
**When** the developer attaches sync for the first time
**Then** the system evaluates both sides through the documented first-attach policy
**And** it applies a deterministic automatic reconciliation policy within the supported bounded model rather than requiring manual conflict resolution for normal cases

**Given** a remote todo exists that has no matching local entity
**When** first attach processes the remote dataset
**Then** the missing remote todo is imported into local state
**And** the resulting local entity is available through the normal local read model

**Given** a local todo exists that has no matching remote entity
**When** first attach processes the local dataset
**Then** the local todo remains intact locally
**And** the documented sync policy determines whether it is queued for later projection rather than being discarded

**Given** both local and remote sides contain the same logical todo with equivalent supported state
**When** first attach compares them
**Then** the entity is treated as non-conflicting
**And** no unnecessary overwrite or duplicate import is performed

**Given** both local and remote sides contain the same logical todo with differing supported state
**When** first attach compares them
**Then** the system resolves the difference automatically according to the documented CRDT-light policy for the supported model
**And** the outcome is deterministic, inspectable, and consistent across devices

**Given** first attach encounters a state difference outside the supported automatic resolution boundaries
**When** reconciliation cannot be completed safely within the documented bounded model
**Then** the system surfaces that exceptional condition explicitly
**And** it preserves trust by avoiding silent data loss or undefined merge behavior

### Story 2.5: Keep Local Use Working Through Offline and Reconnect Cycles

As a developer relying on background sync,
I want the todo demo to continue working locally while sync is interrupted and then resume safely,
So that connectivity problems do not break the app’s normal behavior.

**Acceptance Criteria:**

**Given** Pod sync is attached to the todo demo
**When** network access or Pod availability is temporarily lost
**Then** the local todo workflow continues to support the documented local CRUD behavior
**And** the app does not require immediate remote success in order for local operations to complete

**Given** one or more local todo changes are made while the sync path is unavailable
**When** those local operations complete
**Then** the local state reflects the changes immediately through the normal local-first read model
**And** the sync system preserves the information needed to resume remote synchronization later

**Given** connectivity or Pod availability returns after an interruption
**When** the supported sync mechanism resumes
**Then** pending local todo changes are retried through the documented background flow
**And** the resumed behavior remains consistent with the bounded automatic reconciliation policy

**Given** the sync path experiences interruption and later recovery
**When** a developer reviews the demo behavior and supporting documentation
**Then** they can understand that offline use and later resumption are normal parts of the product model
**And** the explanation does not imply that manual sync choreography is required for ordinary use

**Given** the todo demo is used as a trust proof for background sync
**When** this story is complete
**Then** the repository demonstrates that connectivity problems degrade to continued local-first behavior rather than application failure
**And** reconnect behavior is repeatable enough to support testing and later diagnostics stories

### Story 2.6: Show Inspectable Sync State and Canonical Pod Output

As a developer validating sync behavior,
I want to inspect sync state and canonical Pod-side todo data,
So that I can understand what synchronized and trust the remote representation.

**Acceptance Criteria:**

**Given** the sync-enabled todo demo has local and remote activity
**When** a developer inspects the supported sync-state surface
**Then** they can determine whether sync is attached, whether work is pending, and whether the system is currently healthy enough to continue background synchronization
**And** this inspection uses supported public behavior rather than hidden internals

**Given** local todo changes have been synchronized to the remote target
**When** a developer inspects the canonical Pod-side representation
**Then** they can see todo data stored in the documented canonical RDF form
**And** the representation is understandable as user-controlled data rather than opaque app-private state

**Given** the sync path has experienced recent successful or pending work
**When** the developer compares local demo behavior with sync state and canonical output
**Then** they can understand what has already synchronized and what remains pending
**And** the explanation remains consistent with the local-first mental model

**Given** the project intends to support future user-controlled remote backends beyond Solid Pods
**When** a developer reviews the sync inspection and canonical-output documentation
**Then** it is clear which parts are specific to the current Solid Pod implementation
**And** the architecture remains understandable as a storage-agnostic local-first core with pluggable remote synchronization targets

**Given** the todo demo is used as an early sync trust proof
**When** this story is complete
**Then** the repository gives developers a concrete, repeatable way to inspect both sync status and remote canonical data
**And** that inspection path supports later diagnostics and recovery stories without changing the core programming model

### Story 2.7: Demonstrate Multi-Device Todo Consistency Through the In-Repo Workflow

As a developer evaluating lofipod’s sync promise,
I want a documented and testable multi-device todo scenario in the repository,
So that background sync across devices is proven, not just claimed.

**Acceptance Criteria:**

**Given** two supported local instances of the sync-enabled todo demo are connected to the same remote dataset
**When** a developer creates or updates todo items on one instance through the documented workflow
**Then** the changes are eventually reflected in the other instance through the supported background synchronization path
**And** both instances continue to use their local read models as the primary operational surface

**Given** one instance makes supported todo changes while the other is temporarily offline or disconnected
**When** connectivity is restored and background sync resumes
**Then** the two instances converge to a consistent supported state according to the documented CRDT-light policy
**And** the convergence behavior is repeatable enough to serve as a trust proof for the bounded model

**Given** both instances begin with existing supported local or remote state
**When** the documented attach and synchronization flow is followed
**Then** the resulting behavior remains consistent with the earlier first-attach and reconciliation stories
**And** the demo does not require developers to manually choreograph synchronization steps for ordinary use

**Given** a developer wants to validate what “multi-device” means in practice for lofipod
**When** they review the repository’s demo and verification workflow
**Then** they can run or inspect a concrete end-to-end scenario showing local-first usage, background sync, and eventual consistency across instances
**And** the scenario remains small enough to understand without reading internal implementation details

**Given** Epic 2 is considered complete
**When** the sync-enabled todo demo, supporting docs, and verification workflow are reviewed together
**Then** the repository demonstrates a coherent background-sync story from first attach through multi-device consistency
**And** it provides a stable basis for the later trust, diagnostics, and foreign-change stories

## Epic 3: Trust, Recovery, and Explainability Under Failure

Developers can trust lofipod in real-world failure conditions because sync interruptions, foreign changes, retries, and recovery behavior are visible, diagnosable, and handled predictably within the supported model.

### Story 3.1: Replay Compatible Remote Changes From Another Lofipod Client

As a developer using the same dataset from multiple `lofipod` instances,
I want supported remote changes from another client to be replayed into my local state,
So that ongoing multi-device use remains consistent after initial attach.

**Acceptance Criteria:**

**Given** two compatible `lofipod` clients are connected to the same remote dataset after initial attach is complete
**When** one client creates, updates, or deletes supported todo data
**Then** the other client can discover and replay those supported remote changes into its local state
**And** the resulting local state remains usable through the normal local read model

**Given** the remote changes were produced through the same documented `lofipod` conventions
**When** they are replayed into another client
**Then** the system treats them as supported ongoing changes rather than as unsafe foreign edits
**And** the replay behavior remains within the documented bounded model

**Given** the receiving client already has local state for the affected todo entities
**When** compatible remote changes are replayed
**Then** reconciliation follows the documented CRDT-light policy for supported cases
**And** the outcome is deterministic and consistent across clients

**Given** remote replay occurs after sync is already attached and functioning
**When** the developer reviews the behavior through the demo and supporting documentation
**Then** it is clear that this story covers ongoing compatible remote changes rather than first attach or bootstrap import
**And** the explanation distinguishes replay behavior from manual or unsupported remote edits

**Given** the repository is demonstrating trust in ongoing multi-device use
**When** this story is complete
**Then** the in-repo workflow proves that one `lofipod` client can safely absorb supported changes produced by another
**And** this proof remains small enough to support later diagnostics and recovery stories

### Story 3.2: Reconcile Supported Canonical Remote Changes After Attach

As a developer sharing canonical data across app instances,
I want the app to detect and import supported remote canonical changes after sync is already attached,
So that my local state stays aligned with compatible remote edits.

**Acceptance Criteria:**

**Given** sync is already attached and canonical remote todo data changes after initial bootstrap is complete
**When** the local client detects those remote canonical changes through the supported sync path
**Then** it evaluates them as ongoing post-attach changes rather than as first-attach import work
**And** the resulting behavior remains consistent with the documented bounded model

**Given** a remote canonical change stays within the supported entity shape and invariants
**When** the client reconciles that change into local state
**Then** the local read model is updated to reflect the compatible remote change
**And** the resulting local entity remains usable through the same application-facing workflow as locally produced data

**Given** a supported canonical remote change overlaps with existing local knowledge of the same entity
**When** reconciliation occurs
**Then** the system applies the documented CRDT-light policy for supported cases
**And** the outcome remains deterministic and inspectable rather than ad hoc

**Given** the developer is trying to understand the boundary between supported and unsupported external changes
**When** they review this story’s demo behavior and documentation
**Then** it is clear that this story covers compatible canonical edits after attach
**And** it remains distinct from manual or structurally unsafe remote edits that will be handled in later stories

**Given** the repository is being used to validate trust in shared canonical data
**When** this story is complete
**Then** developers can see a repeatable example of post-attach compatible canonical reconciliation
**And** that example serves as the supported baseline before unsafe-change detection and policy stories

### Story 3.3: Detect and Classify Unsupported or Unsafe Remote Edits

As a developer relying on bounded automatic sync behavior,
I want the system to detect when remote changes fall outside the supported model,
So that unsafe manual edits or incompatible app behavior do not silently corrupt local state.

**Acceptance Criteria:**

**Given** sync is already attached and the remote canonical dataset changes after attach
**When** the client evaluates a newly observed remote change
**Then** it classifies whether the change remains within the supported model or falls outside it
**And** the classification logic follows documented bounded criteria rather than ad hoc heuristics

**Given** a remote change modifies data in a way that remains compatible with the supported entity shape and invariants
**When** the client evaluates that change
**Then** it is classified as supported for automatic reconciliation
**And** it is not treated as an unsafe edit merely because it originated outside the current local instance

**Given** a remote change introduces unsupported structure, invalid shape, ambiguous semantics, or otherwise unsafe state
**When** the client evaluates that change
**Then** it is classified as unsupported or unsafe for automatic reconciliation
**And** the system avoids silently importing it as if it were an ordinary supported update

**Given** a developer or user manually edits canonical Pod data outside the documented `lofipod` conventions
**When** the client later encounters those remote changes
**Then** the system can distinguish that situation from normal compatible replay
**And** the resulting classification is inspectable enough to support later policy and diagnostics stories

**Given** the repository is demonstrating the limits of the CRDT-light model
**When** this story is complete
**Then** developers can see a concrete example of how supported remote changes are separated from unsupported ones
**And** that boundary remains understandable as part of the product’s trust model rather than as hidden implementation behavior

### Story 3.4: Apply Documented Policy Responses to Unsupported Remote Changes

As a developer troubleshooting unexpected remote edits,
I want `lofipod` to respond to unsupported cases in a predictable documented way,
So that failure behavior is trustworthy even when the system cannot automatically reconcile safely.

**Acceptance Criteria:**

**Given** a remote change has already been classified as unsupported or unsafe for automatic reconciliation
**When** the client applies the documented policy response
**Then** it follows a consistent bounded behavior rather than leaving the outcome undefined
**And** the policy is understandable enough that a developer can predict what the system will do next

**Given** the unsupported remote change cannot be safely merged into local state
**When** policy handling occurs
**Then** the system preserves trust by avoiding silent corruption or destructive overwrite of local data
**And** the existing supported local state remains usable through the normal local-first surface unless the documented policy explicitly says otherwise

**Given** the system encounters an unsupported remote condition more than once
**When** the same class of condition is re-evaluated
**Then** the documented policy response remains consistent across occurrences
**And** the behavior does not depend on hidden operator intervention or ad hoc decisions

**Given** a developer is reviewing how `lofipod` behaves outside its supported automatic boundaries
**When** they inspect the demo scenario and documentation for this story
**Then** they can understand the difference between supported reconciliation, unsupported classification, and policy response
**And** the repository shows that unsupported cases are handled explicitly rather than silently ignored

**Given** the project aims for a CRDT-light trust model rather than arbitrary merge behavior
**When** this story is complete
**Then** developers can see that unsupported remote edits trigger a defined protective response
**And** that response creates a stable basis for diagnostics and later recovery workflows

### Story 3.5: Explain What Changed, What Synced, and What Failed

As a developer diagnosing sync behavior,
I want to inspect meaningful sync and state explanations,
So that I can tell what changed locally, what synchronized remotely, and what did not.

**Acceptance Criteria:**

**Given** the sync-enabled todo demo has processed local changes, remote changes, or failed work
**When** a developer inspects the supported diagnostics and explanation surface
**Then** they can distinguish local application state, remote canonical state, and sync-related state
**And** those distinctions are presented consistently with the documented mental model

**Given** one or more local todo changes have been made
**When** the developer reviews the available sync explanation
**Then** they can determine which changes have already synchronized, which remain pending, and which failed to synchronize
**And** the explanation does not require reading hidden internal structures to understand the outcome

**Given** a supported or unsupported remote change has been detected after attach
**When** the developer inspects the resulting explanation
**Then** they can tell whether the change was automatically reconciled, classified as unsupported, or handled through a documented policy response
**And** the explanation remains specific enough to support debugging and trust

**Given** diagnostics are part of a privacy-respecting local-first product
**When** explanatory state or logs are exposed to the developer
**Then** they avoid leaking credentials, access tokens, or unnecessary private content by default
**And** the diagnostic surface remains useful without depending on centralized telemetry

**Given** the repository is being used as a trust proof for imperfect real-world behavior
**When** this story is complete
**Then** developers have a concrete, repeatable way to understand what changed, what synced, and what failed in the in-repo workflow
**And** that understanding supports later recovery work without changing the product’s local-first programming model

### Story 3.6: Recover Cleanly From Interrupted or Failed Sync Work

As a developer using lofipod in imperfect network conditions,
I want interrupted or failed sync work to recover through a repeatable supported path,
So that temporary failure does not turn into permanent uncertainty.

**Acceptance Criteria:**

**Given** sync work has been interrupted or failed because of temporary network, Pod, or related runtime conditions
**When** the underlying condition clears and the supported recovery path resumes
**Then** the system retries the affected sync work through the documented background mechanism
**And** recovery remains consistent with the bounded automatic reconciliation model

**Given** local todo changes were accepted before the interruption occurred
**When** sync recovery runs later
**Then** those supported local changes are still represented in local state and in the pending or recoverable sync path as appropriate
**And** the developer is not required to reconstruct the intended changes manually in normal supported cases

**Given** remote replay or canonical reconciliation was interrupted mid-flow
**When** recovery resumes through the supported mechanism
**Then** the resulting local and remote understanding converges toward the same deterministic supported outcome
**And** the system does not depend on hidden operator repair for ordinary transient failures

**Given** a developer is diagnosing whether a failure was temporary or left unresolved state behind
**When** they use the documented explanation and recovery path
**Then** they can tell that recovery has resumed, completed, or remains blocked by an exceptional condition
**And** the recovery behavior stays understandable without requiring internal implementation knowledge

**Given** Epic 3 is considered complete
**When** the repository’s trust, diagnostics, and recovery workflow is reviewed together
**Then** the project demonstrates a coherent story for ongoing remote replay, unsafe-change handling, explanation, and clean recovery from interrupted sync work
**And** that story provides a stable boundary before later schema-evolution and broader interoperability epics

## Epic 4: Safe Evolution of Data and Application Semantics

Developers can change their application model over time, preserve trust in existing data, and retain portable canonical semantics that support future reuse without data loss in supported scenarios.

### Story 4.1: Evolve the Todo Entity Model Without Breaking Local Reads

As a developer improving the demo app,
I want to change the supported todo model over time,
So that the app can evolve without stranding existing local data.

**Acceptance Criteria:**

**Given** the in-repo todo demo already has stored local data using an earlier supported todo model
**When** the developer introduces a new supported version of the todo entity model
**Then** the application can still read previously stored todo data through the local-first workflow
**And** the change remains within the documented bounded evolution path

**Given** the todo model changes in a way supported by the Phase 1 architecture
**When** the updated application code starts using the new model
**Then** the developer is not required to discard existing local data or rebuild the dataset from scratch
**And** the local read behavior remains available while later migration or repair work takes place

**Given** a developer is evaluating whether model evolution is a supported feature or an accidental side effect
**When** they review the demo and documentation for this story
**Then** it is clear that bounded entity-model evolution is part of the intended product contract
**And** the explanation distinguishes supported model changes from arbitrary schema or RDF mutation expectations

**Given** the project aims to make local-first and Pod-backed app building practical over time
**When** this story is complete
**Then** the repository demonstrates that a supported todo model can evolve without immediately breaking basic local reads
**And** this forms the baseline for later reprojection, migration, and canonical compatibility stories

### Story 4.2: Reproject Existing Local Data Into the Updated Model

As a developer changing entity semantics,
I want existing local todo data to be reprojected or repaired into the new supported model,
So that previously stored data remains usable after the change.

**Acceptance Criteria:**

**Given** local todo data was stored using an earlier supported model and the application now uses an updated supported model
**When** the engine reads or processes the existing local data through the new model definition
**Then** it can reproject or repair that data into the updated supported shape
**And** the resulting application-facing entity remains usable through the normal local workflow

**Given** the updated model implies a different supported canonical or projected interpretation than the previously stored local representation
**When** the system determines that reprojection or repair is required
**Then** it performs that work through the documented bounded mechanism
**And** the change is treated as part of the supported local evolution path rather than as silent undefined behavior

**Given** reprojection or repair changes the effective local representation of a todo entity
**When** the developer later reads or lists that entity
**Then** the updated result reflects the new supported semantics consistently
**And** the earlier stored data is not simply abandoned as unreadable

**Given** a developer is validating how local evolution works in practice
**When** they review the demo behavior and documentation for this story
**Then** they can understand when reprojection or repair happens, what kind of supported change it covers, and why it preserves local trust
**And** the explanation remains distinct from broader migration across arbitrary unsupported schema changes

**Given** the repository is demonstrating safe local evolution rather than one-time upgrade luck
**When** this story is complete
**Then** developers can see a repeatable example of existing local todo data being brought into the updated model
**And** that example provides the local foundation for later remote and migration stories

### Story 4.3: Preserve Canonical Pod Compatibility During Model Evolution

As a developer syncing evolved app data to remote storage,
I want canonical Pod data to remain interpretable and reusable through the supported migration path,
So that application evolution does not destroy remote portability.

**Acceptance Criteria:**

**Given** the todo model has evolved through a supported change and canonical Pod data already exists for earlier versions
**When** the updated application interacts with that canonical remote data
**Then** the system preserves a documented supported path for interpreting or transitioning the remote representation
**And** the remote data does not become meaningless solely because the local model evolved

**Given** the updated model changes how the todo entity should be represented canonically
**When** synchronization or migration work touches the remote dataset
**Then** the resulting canonical Pod data remains within the documented reusable bounded model
**And** it continues to serve as user-controlled data rather than app-private opaque state

**Given** a developer inspects canonical Pod data before and after a supported model evolution step
**When** they compare the representations
**Then** they can understand how the evolution path preserves remote interpretability
**And** the explanation distinguishes supported canonical evolution from arbitrary RDF mutation support

**Given** the architecture is intended to remain open to future user-controlled remote storage backends
**When** developers review the migration and compatibility story
**Then** it is clear which compatibility guarantees belong to canonical data semantics and which belong specifically to the current Solid Pod implementation
**And** the underlying local-first evolution model remains comprehensible as storage-backend-flexible

**Given** the repository is demonstrating that local app evolution need not break remote portability
**When** this story is complete
**Then** developers can see a repeatable example of model evolution that preserves canonical reuse expectations
**And** that example supports later safe-migration and future-reuse stories

### Story 4.4: Migrate Supported Existing Data Without Data Loss

As a developer upgrading a real app,
I want supported local and remote todo data to migrate safely,
So that version changes do not cause silent loss or ambiguity.

**Acceptance Criteria:**

**Given** a supported todo model change requires migration rather than simple read-through compatibility
**When** the developer upgrades the application to the new supported version
**Then** the system provides a documented supported migration path for the affected local and remote data
**And** the migration remains within the bounded Phase 1 scope

**Given** supported local todo data and supported canonical remote todo data exist before the upgrade
**When** migration is applied through the supported path
**Then** the resulting data preserves the intended todo information without silent loss in normal supported scenarios
**And** the upgraded application continues to operate on the migrated result through the normal local-first workflow

**Given** migration work changes either local representation, canonical remote representation, or both
**When** the developer inspects the upgraded state after migration
**Then** the resulting data is consistent with the updated supported semantics
**And** the migration outcome is not left ambiguous or dependent on hidden one-off repair steps

**Given** a migration cannot be fully completed within the documented supported model
**When** the system encounters that condition
**Then** the incomplete or exceptional migration state is surfaced explicitly
**And** the behavior preserves trust by avoiding silent corruption or false claims of success

**Given** the repository is being used to prove that evolution is safe rather than theoretical
**When** this story is complete
**Then** developers can see a repeatable example of supported data migration without data loss in the bounded model
**And** that example provides the basis for later inspection and future-reuse stories

### Story 4.5: Inspect and Explain Migration Outcomes

As a developer validating an upgrade,
I want to inspect what was migrated, repaired, or left unchanged,
So that I can trust the result of model evolution.

**Acceptance Criteria:**

**Given** a supported model evolution step has triggered reprojection, repair, or migration work
**When** the developer inspects the resulting state through the supported explanation surface
**Then** they can tell which todo data was migrated, which was repaired during read or upgrade, and which remained unchanged
**And** the explanation is specific enough to support confidence in the outcome

**Given** local and canonical remote data may both participate in the supported evolution path
**When** the developer reviews migration outcomes
**Then** they can distinguish what happened locally from what happened in the canonical remote representation
**And** the explanation remains consistent with the documented local-first and canonical-data mental model

**Given** a supported migration completed successfully
**When** the developer reviews the explanation and resulting data
**Then** the outcome is presented as a coherent supported transition rather than as hidden internal mechanics
**And** the explanation helps the developer understand why the evolved data is now valid

**Given** a migration or repair step encountered an exceptional or incomplete condition
**When** the developer inspects the result
**Then** that exceptional state is surfaced explicitly rather than buried or implied
**And** the explanation provides enough context for the developer to understand why trust should be withheld until the condition is resolved

**Given** the repository is proving that evolution remains understandable, not merely possible
**When** this story is complete
**Then** developers can see a repeatable example of inspecting migration outcomes in the in-repo workflow
**And** that example reinforces the project’s trust model for later adoption and future-reuse work

### Story 4.6: Keep the Evolution Path Bounded and Future-Reuse Friendly

As a developer planning beyond the first demo,
I want the supported evolution path to stay constrained but compatible with future reuse,
So that the Phase 1 model can grow without pretending to support arbitrary change.

**Acceptance Criteria:**

**Given** the project supports only a bounded class of entity evolution in Phase 1
**When** developers review the supported migration and evolution guidance
**Then** it is clear which kinds of model changes are intentionally supported
**And** the documentation does not imply general-purpose schema evolution or arbitrary RDF mutation support

**Given** a supported evolution path is being designed for the todo demo and later real applications
**When** that path affects canonical remote data semantics
**Then** the resulting canonical model remains understandable and reusable enough to support future compatible applications
**And** the design does not require redefining the Phase 1 capability contract to preserve basic portability

**Given** the architecture should remain open to future user-controlled remote backends beyond Solid Pods
**When** developers review the evolution constraints and compatibility guarantees
**Then** they can distinguish core semantic guarantees from backend-specific implementation details
**And** the bounded evolution model still makes sense if additional remote storage mechanisms are added later

**Given** a developer is deciding whether the product is honest about its scope
**When** they inspect the Epic 4 outcomes and surrounding documentation
**Then** they can see that `lofipod` supports a practical constrained evolution path rather than claiming universal migration safety
**And** that honesty strengthens trust in the product’s long-term direction

**Given** Epic 4 is considered complete
**When** the evolution, migration, explanation, and compatibility stories are reviewed together
**Then** the repository demonstrates a coherent bounded path for changing the app model without losing trust or destroying portable semantics
**And** that path provides a stable foundation for later adoption-hardening work

<!-- Repeat for each story (M = 1, 2, 3...) within epic N -->

### Story {{N}}.{{M}}: {{story_title_N_M}}

As a {{user_type}},
I want {{capability}},
So that {{value_benefit}}.

**Acceptance Criteria:**

<!-- for each AC on this story -->

**Given** {{precondition}}
**When** {{action}}
**Then** {{expected_outcome}}
**And** {{additional_criteria}}

<!-- End story repeat -->
