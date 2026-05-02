---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - /media/michal/data/code/lofipod/_bmad-output/project-context.md
  - /media/michal/data/code/lofipod/README.md
  - /media/michal/data/code/lofipod/docs/ADR.md
  - /media/michal/data/code/lofipod/docs/API.md
  - /media/michal/data/code/lofipod/docs/PLANS.md
  - /media/michal/data/code/lofipod/docs/WIP.md
  - /media/michal/data/code/lofipod/docs/QUICKSTART.md
  - /media/michal/data/code/lofipod/docs/TESTING.md
  - /media/michal/data/code/lofipod/docs/index.md
  - /media/michal/data/code/lofipod/docs/project-overview.md
  - /media/michal/data/code/lofipod/docs/architecture.md
  - /media/michal/data/code/lofipod/docs/source-tree-analysis.md
  - /media/michal/data/code/lofipod/docs/component-inventory.md
  - /media/michal/data/code/lofipod/docs/development-guide.md
  - /media/michal/data/code/lofipod/docs/deployment-guide.md
  - /media/michal/data/code/lofipod/docs/contribution-guide.md
workflowType: "prd"
releaseMode: phased
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 16
classification:
  projectType: developer tool / library
  domain: local-first data and sync infrastructure
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - lofipod

**Author:** Michał
**Date:** 2026-04-25

## Executive Summary

lofipod is a developer tool and library for building local-first applications with SOLID Pod-backed synchronization. It is aimed primarily at application developers who want to ship offline-capable apps without building custom sync infrastructure, while preserving user-controlled, reusable data in interoperable Pod storage. A secondary adjacent audience is Solid and personal-data enthusiasts who want better ergonomics and performance than the current ecosystem typically provides.

The product solves a specific adoption gap: local-first application development is valuable, SOLID Pods are valuable, but combining them is still too difficult, too slow, or too architecture-heavy for ordinary application work. lofipod addresses that gap by giving developers a practical local programming model, local persistence by default, and background synchronization to a Pod-backed canonical RDF representation. The intended user experience is simple: define a shallow entity, persist it locally, attach a Pod, and have data synchronize across devices while remaining visible and reusable outside the app.

The core product bet is that most useful applications do not need full CRDT generality, arbitrary collaborative editing, or RDF-native modeling in every application layer. Instead, they need a deliberately constrained model that makes the hard parts of sync reliable, teachable, and fast enough for real application development. lofipod therefore prioritizes shallow entity graphs, practical CRUD-oriented development, background sync, and interoperable Pod data over theoretical completeness.

### What Makes This Special

lofipod differentiates itself by combining four properties that are rarely delivered together: local-first application behavior, a deliberately constrained data model, SOLID Pod interoperability, and a developer experience that does not require expertise in CRDT design, RDF modeling, or bespoke sync plumbing. The product is not trying to be a general RDF engine, a complete CRDT framework, or a UI state library. Its value comes from narrowing the problem until local-first + Pod sync becomes boring to build.

The key insight is pragmatic rather than maximalist: simplicity is a feature. By accepting scope boundaries and modeling constraints, lofipod can keep application development simple while still producing canonical Pod data that is inspectable, portable, and reusable across devices and potentially across compatible tools. Developers should choose lofipod when they want local-first behavior and user-owned Pod data without paying the complexity cost of full CRDT stacks, raw Solid/RDF tooling, or repeated one-off sync implementations.

## Project Classification

- **Project Type:** developer tool / library
- **Domain:** local-first data and sync infrastructure
- **Complexity:** medium
- **Project Context:** brownfield

## Product Principles

This section defines the product invariants that the rest of the PRD elaborates.

- Local-first by default: developers build against local state first, not remote coordination first.
- Sync stays in the background: Pod-backed synchronization must support the app without becoming the app's primary programming model.
- Trust comes from predictability: developers and users must be able to understand what changed, what synchronized, and what needs attention.
- Recovery beats mystery: when the supported model cannot resolve something automatically, the system must surface that condition clearly instead of hiding it.

## Success Criteria

### User Success

A developer should be able to follow the official tutorial and build a basic todo application with local persistence and SOLID Pod synchronization in a couple of hours. The onboarding path should be straightforward enough that the developer can experience the full local-first + Pod-backed workflow in a single session, without writing custom sync logic or becoming an expert in RDF modeling.

A developer using an LLM agent should be able to build a more complex application with correct use of lofipod and RDF in roughly one day. This is not a secondary convenience feature; it is an explicit usability signal that the API, examples, and data model are clear enough to be applied correctly by both human developers and AI-assisted workflows.

### Business Success

The project should demonstrate sustained application-building velocity, with roughly one application built on top of lofipod per month during the first 12 months. These applications may be built initially by the project author, but they must represent real usage rather than toy examples.

Within the first year, lofipod should attract a second serious builder, contributor, or adopter. This is the first clear signal that the library is understandable and useful outside the original author's head.

Within 18 months, lofipod should be included or referenced on Solidproject ecosystem pages or equivalent community visibility surfaces. Within 6 months, there should be evidence that multiple applications can share data through the model in a meaningful way.

### Technical Success

Within 3 months, lofipod should reach a stable `1.0` release. After that point, the public API should not require further breaking changes except in exceptional circumstances. Before the `1.0` milestone, breaking changes may still occur, but they should be limited and purposeful rather than frequent architectural churn.

Feature breadth may remain intentionally limited, but synchronization quality cannot be soft. For the supported model, synchronization must be reliable enough for early adopters to trust it with real applications. The standard is clear: no data loss in normal supported usage. The product may win by being narrow, but it cannot win by being unreliable.

### Measurable Outcomes

- A new developer can complete a tutorial-driven todo app in `<= 2 hours`.
- An LLM-assisted builder can produce a more complex working application using lofipod and RDF in `<= 1 day`.
- The project reaches `1.0` within `3 months`.
- Breaking API changes drop to effectively zero after `1.0`.
- At least `12` applications are built on top of lofipod in the first `12 months`, averaging one per month.
- At least `1` additional contributor or serious external builder appears within the first `12 months`.
- At least `1` ecosystem recognition milestone, such as inclusion on Solidproject pages, is achieved within `18 months`.
- Demonstrated cross-application shared-data behavior exists within `6 months`.

## Product Scope

This section defines the product boundary. Delivery is intentionally phased; sequencing is defined later in `Project Scoping & Phased Development`.

### MVP - Minimum Viable Product

The MVP is defined by practical sufficiency rather than broad feature coverage. It must support a single-user, shallow-entity collection application with deterministic identity, standard CRUD behavior, and no deep graph merges. The proving ground is `y-felin`, but the success condition is architectural trust for the bounded app class rather than app completion alone.

The MVP includes:

- a stable-enough public API for one real application
- local-first persistence and CRUD over shallow entities
- background Pod-backed synchronization across multiple devices
- a narrow but reliable conflict and migration model
- inspectable local state, Pod-backed state, and sync state
- one predefined foreign-change policy for supported Pod-side mutations

### Growth Features (Post-MVP)

Growth begins when lofipod moves beyond one bounded app class into practical multi-application reuse over shared user-owned data.

Growth scope includes:

- multiple applications sharing the same underlying user-owned data
- broader handling of external or out-of-band changes
- stronger examples, guidance, and proof that the model works across more than one application context
- broader ecosystem credibility around the constrained-model approach

### Vision (Future)

The long-term vision is a credible ecosystem and public showcase for pragmatic local-first development with user-owned Pod-backed data.

Vision scope includes:

- an ecosystem of applications built on top of lofipod
- practical demonstrations of cross-application interoperability
- broader recognition that constrained local-first + Pod-backed development is a viable alternative to both raw Solid tooling and heavyweight sync systems
- a durable showcase for how to make Solid Pods work in real application development

### Scope At A Glance

| Area              | In Scope Now                                                | Deferred                                                        |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| App model         | Single-user, shallow-entity collection apps                 | Deep graph merges and broader collaborative models              |
| Sync              | Background sync for one bounded app across multiple devices | Broad multi-app interoperability and arbitrary external writers |
| Conflict handling | CRDT-light resolution within documented constraints         | General CRDT semantics outside the bounded model                |
| Schema evolution  | One real supported migration path                           | Broader compatibility machinery across many app families        |
| External changes  | One predefined policy-governed Pod-side mutation class      | General foreign RDF merge behavior                              |
| Ecosystem         | Strong docs and one real proving-ground app                 | Multi-framework breadth and broader ecosystem packaging         |

## User Journeys

### Journey 1: A Developer Evaluates lofipod and Reaches First Proof of Value

We meet Michał, a busy developer who wants a private bullet-journal-style tool for tasks and comments. He is not looking for a startup platform or a research project. He wants something useful for himself, starting as a CLI, with data that remains under his control and does not get trapped inside a single application.

He considers the alternatives and finds the same friction everywhere. CRDT-oriented systems seem more general than he needs. Raw Solid and RDF tooling seem too theory-heavy for a practical app he wants to use soon. He does not want to become an expert in sync algorithms, RDF modeling, or backend infrastructure just to track his own work.

The rising action is evaluation: can he understand the mental model, define a shallow entity, persist it locally, and connect it to his own Solid Pod without getting lost? The climax is the first proof-of-value moment: local reads and writes work, Pod-backed sync works, and the app still feels like an ordinary local tool rather than a distributed systems project. The resolution is confidence that lofipod is understandable enough to adopt and useful enough to keep building on.

This journey reveals requirements for:

- fast onboarding from tutorial to working application
- a clear mental model of local state, canonical Pod data, and background sync
- minimal-ceremony setup for the first working entity
- early proof that Pod sync can be enabled without custom sync code
- documentation and examples strong enough for a developer to decide the library is safe to invest in

### Journey 2: The Builder Gets a Private Tool That Just Works Across Devices

After adoption, the developer builds the real tool they wanted: a bullet-journal-style CLI for tasks and comments. The need is practical and personal. They want an app that works offline, feels fast locally, and can still synchronize across their own devices using their own Pod.

The tension is that most tools either keep data trapped in one application or demand too much architectural complexity to get local-first behavior and interoperable storage together. With lofipod, the story stays simple: define the relevant entities, persist locally, attach Pod sync, and let replication happen in the background.

The climax is a trust moment, not a protocol milestone. The app still behaves like a local tool, yet the data appears on another device and remains visible in the Pod. The resolution is that the developer now has a private, portable tool that serves them directly without relying on a centralized service.

This journey reveals requirements for:

- local-first persistence by default
- practical CRUD-oriented entity modeling
- reliable background synchronization across devices
- user-controlled canonical data in the Pod
- a programming model that keeps the distributed aspects from dominating app code

### Journey 3: The Developer Evolves the Model Without Losing Live Data

The app is now in use and contains real personal data. A new feature idea appears, but it requires changing the model. The emotional stakes rise immediately because this is no longer a safe prototype. Existing data matters, and losing it would destroy trust.

The tension is not merely whether a migration is technically possible, but whether the system can evolve safely while preserving local state, canonical Pod data, and sync integrity. The climax is the moment the new version opens old data, repairs or migrates what it must, and continues operating without loss. The resolution is confidence that the app can keep evolving without forcing the user to choose between progress and safety.

This journey reveals requirements for:

- safe model evolution and migration paths
- backward-compatible reads or repair mechanisms
- no-data-loss guarantees in supported scenarios
- explicit handling of canonical graph and projection changes
- trust signals when data is repaired, reprojected, or upgraded

### Journey 4: A Developer Builds a Second Surface Over Shared Data

The original app is useful, but a second interface becomes valuable. Perhaps the richer CLI model should also support a simpler reading or focused interaction surface. Perhaps a web app should coexist with the CLI over the same underlying user-owned data. The need is not “multiple UIs for style points,” but practical reuse without duplicating or locking data.

The tension is whether shared data can support multiple applications without forcing every app to inherit full complexity or corrupt shared meaning. The climax is that a second app, with its own interface and priorities, can read and write against the same logical dataset while remaining compatible with the original application. The resolution is that reusable data becomes a practical multi-application capability rather than an abstract interoperability claim.

This journey reveals requirements for:

- multiple application surfaces over shared user-owned data
- clear compatibility promises in the shared canonical model
- support for narrower or simpler projections over richer records
- interoperability that survives real-world application differences
- stable conventions that independent builders can rely on

### Journey 5: Independent Builders Interoperate Without Central Coordination

A second builder, such as the original developer’s web-focused friend, wants to build another application against the same dataset. There is no shared backend team, no central operator, and no internal API owner coordinating everything. The product promise is that independent builders should still be able to work over shared user-controlled data through stable conventions.

The tension is whether that promise survives contact with reality. If the second builder must reverse-engineer opaque assumptions or app-private storage, the story fails. The climax is that the second builder succeeds using the documented model and canonical Pod data, without needing privileged access to a central service or hidden implementation knowledge. The resolution is that cross-app compatibility without central coordination becomes credible.

This journey reveals requirements for:

- shared data conventions that are documented and stable
- canonical representations usable by independent builders
- browser and CLI compatibility over the same logical model
- external change import and reconciliation that works in practice
- examples and documentation good enough for second-party adoption

### Journey 6: The Developer Diagnoses and Recovers from Failure Without Backend Observability

Something goes wrong: a device is offline for too long, sync is interrupted, a conflicting change appears, a migration only partially succeeds, or remote state looks malformed. In a centralized SaaS system, an operator would inspect backend logs. Here, that path is intentionally unavailable. There is no HQ and no centralized observability surface with full user data.

The real actor is the app developer, sometimes with user-shared evidence, trying to understand and recover from distributed state issues on user-controlled devices and Pods. The climax is not merely finding a bug; it is being able to explain what happened, recover safely, and avoid silent data loss using local inspection tools, privacy-preserving logs, and reproducible sync state. The resolution is that the product can be trusted because failure is diagnosable and recoverable even without a central service.

This journey reveals requirements for:

- privacy-preserving diagnostics and logs
- local inspection tools for sync and state behavior
- recovery paths for offline divergence, interrupted sync, and malformed remote state
- clear separation between app bugs, library bugs, and Pod/environment issues
- resilience behavior that preserves trust under failure

### Journey 7: End Users and Builders Manage Data Access and Ownership Explicitly

Because there is no central service, responsibility boundaries matter more, not less. Someone must configure Pod access, understand what an app can read or write, and retain confidence that data remains under user control. The challenge is not operator administration, but decentralized trust.

The builder needs to integrate access flows that users can actually complete. The user needs to understand that their data is theirs, that app access is intentional, and that privacy is preserved without making the system impossible to use. The climax is a successful onboarding and permission flow that makes decentralized ownership feel usable rather than burdensome. The resolution is a trust model that is concrete, not atmospheric.

This journey reveals requirements for:

- understandable Pod/account setup flows
- explicit and usable access/permission boundaries
- clear ownership and control expectations between user, app, and Pod
- privacy promises that remain testable in real workflows
- a decentralized trust model that developers can implement and users can understand

### Journey 8: The Developer Trusts the Data Will Remain Portable and Recoverable

A serious local-first developer eventually asks a hard question: if I stop using lofipod, can I still understand, preserve, inspect, and reuse the data? This is not a fringe concern. It is part of the adoption decision for any tool that claims to support user-controlled data.

The tension is whether portability is real or merely rhetorical. The climax is the developer confirming that the data remains inspectable, exportable, recoverable, and useful outside the immediate application and outside exclusive dependence on lofipod-specific internals. The resolution is that adopting lofipod does not feel like exchanging one kind of lock-in for another.

This journey reveals requirements for:

- inspectable and portable canonical data
- recoverability without centralized rescue paths
- stable enough semantics for migration or exit
- confidence that user-owned data outlives any one app surface or implementation choice

### Journey Requirements Summary

These journeys collectively require lofipod to support:

- first-mile onboarding and fast proof of value
- a clear mental model for local-first state and Pod-backed sync
- reliable single-app, multi-device synchronization
- safe schema and model evolution without data loss
- multiple application surfaces over shared user-owned data
- interoperability between independent builders without central coordination
- privacy-preserving diagnostics and failure recovery
- explicit decentralized ownership, access, and trust boundaries
- portable, inspectable, and recoverable canonical data

## Domain-Specific Requirements

### Compliance & Regulatory

lofipod itself does not introduce domain-specific regulatory requirements in the way that hosted SaaS platforms in regulated sectors do. Data hosting and associated regulatory obligations are pushed outward to either the user controlling their own Solid Pod or the Solid Pod provider they choose. As a result, lofipod and applications built on top of it should not be treated as carrying Pod-hosting compliance obligations by default unless their own application domain independently requires them.

### Technical Constraints

The main domain-specific constraints are not regulatory but architectural. lofipod operates in a local-first, user-controlled data environment where there is no central service, no central operator, and no guaranteed backend observability. This creates hard requirements around reliable synchronization, safe schema evolution, portable canonical data, and privacy-preserving diagnostics. The system must remain understandable and trustworthy even when data is distributed across devices and Pods outside the control of the library author.

### Integration Requirements

The key integration boundary is the Solid ecosystem itself. lofipod must work with user-controlled Pods and Pod providers without assuming uniform operational quality, uniform tooling maturity, or centralized service guarantees. Interoperability with canonical RDF data and compatibility across independently built apps are more important than deep coupling to any one hosting or application environment.

### Risk Mitigations

The main risks in this domain are ecosystem and architecture risks rather than regulatory ones. These include Pod reliability variance, authentication and onboarding friction, inconsistent tooling across the Solid/RDF ecosystem, and the difficulty of diagnosing problems without centralized telemetry. These risks should be mitigated through constrained scope, strong documentation, clear mental models, privacy-preserving diagnostics, and a narrow synchronization model that prioritizes trust and recoverability over maximal feature breadth.

## Innovation & Novel Patterns

### Detected Innovation Areas

lofipod's innovation is not a new synchronization algorithm or protocol. Its innovation is an opinionated local-first application model for SOLID Pods that makes adoption practical by constraining the problem. Instead of maximizing generality, it standardizes the common case through shallow entities, a simple local operational model, canonical RDF persistence in the Pod, and predictable sync semantics.

The core product bet is that this deliberately constrained pattern unlocks something broader approaches often fail to make practical: repeatable delivery of interoperable local-first applications without forcing each builder to invent their own sync model, conflict assumptions, or RDF architecture. The novelty is therefore architectural and productized rather than theoretical. lofipod attempts to turn a hard, open-ended systems problem into a narrow, teachable, and reusable application pattern.

This innovation also depends on a principled split between the local operational model and the canonical RDF-in-Pod model. Developers work with a practical application-facing representation while still preserving inspectable, portable, and reusable canonical data remotely. The value is not just that the split exists, but that it removes everyday developer pain while retaining the interoperability benefits of user-controlled Pod storage.

### Market Context & Competitive Landscape

The market context remains important, but it is secondary to the innovation thesis. Existing approaches often fall into three camps: CRDT-heavy systems that optimize for broad distributed-data generality, raw Solid/RDF tooling that preserves openness at the cost of ergonomics, and bespoke local database plus custom sync stacks that repeatedly recreate complexity and usually trap data inside app-specific models.

lofipod is differentiated by refusing all three extremes. It does not try to out-generalize CRDT systems, out-purify RDF tooling, or out-scale bespoke sync platforms. Its claim is that many developers need a narrower middle pattern: an opinionated, constrained application model that makes local-first + Pod-backed development practical for a large class of CRUD-like apps.

### Validation Approach

The innovation should be validated against the specific hypothesis that constrained architectural defaults materially reduce implementation complexity and increase repeatability for the target class of apps. The first proof is onboarding: a developer should be able to get a real local-first + Pod-synced application working quickly without designing a sync engine or a custom RDF mapping strategy from scratch.

The second proof is repeatability. The constrained model should support multiple real applications, not just one carefully curated example. Stronger evidence comes from architectural reuse across several distinct apps and surfaces, including CLI and web contexts, built over the same core conventions and canonical data model.

The final proof is exclusion clarity. The innovation only holds if lofipod makes certain classes of problem intentionally easier while being explicit about what it does not optimize for. If every kind of data model and collaboration pattern is still expected to fit, then the simplification is not sharp enough to count as real innovation.

### Risk Mitigation

The primary risk is that the product is perceived as a sensible packaging of existing ideas rather than as a meaningful architectural innovation. This should be mitigated by making the innovation mechanism explicit: the constraints are not incidental limitations, but the design strategy that makes the common case implementable, teachable, and reusable.

A second risk is that the innovation remains too vague unless the exclusions are clear. lofipod must be explicit that it is not optimizing for arbitrary collaborative editing, general-purpose RDF modeling, or unconstrained distributed data structures. Its strength depends on clearly naming the class of applications it makes easier and the classes it intentionally does not target.

A third risk is ecosystem friction. Even with a strong innovation thesis, Pod reliability variance, authentication friction, and RDF tooling inconsistency can obscure the value. These risks should be mitigated through strong examples, constrained defaults, clear diagnostics, and proof that the same architectural pattern works repeatedly across real applications rather than in a single showcase.

## Developer Tool / Library Specific Requirements

### Project-Type Overview

lofipod is a TypeScript-first developer tool and library aimed at application developers who want to build local-first apps with SOLID Pod-backed synchronization without taking on the full complexity of sync architecture, RDF modeling, or custom backend design. The product must behave like infrastructure that is easy to adopt, hard to misuse, and stable enough to become part of real applications rather than remaining an experiment.

The library should be optimized for two closely related adoption paths: direct use by a human developer and correct use by an LLM-assisted builder. In both cases, the product succeeds only if the public API is easy to understand, the setup path is short, and the documentation makes the purpose and constraints of the model obvious before the developer disengages.

### Technical Architecture Considerations

The public API must remain simple, explicit, and stable. The core abstraction should revolve around entities and their lifecycle rather than exposing storage or sync internals as first-class developer concerns. Outside of the explicit connection to a Pod provider, the storage layer should be as invisible as possible in normal application development. Developers should feel like they are building local-first applications, not assembling a storage stack.

TypeScript is the first-class authoring experience, but JavaScript consumption must remain supported. Both Node and browser environments must be treated as first-class targets rather than one being a secondary adaptation of the other. This requires maintaining a clean package boundary between the environment-neutral core and the environment-specific entrypoints.

The developer-facing architecture should preserve:

- a small, explicit public API surface
- entity-centered application design
- optional, attachable synchronization rather than mandatory remote coupling
- an environment-neutral core with separate browser and Node entrypoints
- a stable mental model where local behavior is primary and Pod synchronization is additive

### Language and Platform Requirements

- TypeScript is the primary supported language and should provide the best developer experience.
- JavaScript must remain a supported consumption path.
- Node and browser runtimes are both first-class supported environments.
- Environment-specific capabilities must remain behind the dedicated public entrypoints rather than leaking into the core package.
- The API should remain consistent enough that examples and concepts transfer cleanly across both environments.

### Installation and Packaging Requirements

- npm is the primary and sufficient installation method for the current product scope.
- The package experience should be straightforward for developers using standard npm workflows.
- Packaging should reinforce the public surface clearly:
  - `lofipod` for the framework-agnostic core
  - `lofipod/browser` for browser-specific adapters
  - `lofipod/node` for Node-specific adapters
- Installation and first-use flows should avoid unnecessary conceptual overhead.

### Documentation and Example Requirements

Documentation is a core product feature for this project type, not a support artifact. The docs must help a developer understand both the practical workflow and the conceptual value quickly enough to prevent early disengagement.

Required documentation outcomes:

- a strong `README.md` that is concise, approachable, and effective as a first contact document
- a `Quickstart` that gets a developer from zero to a working mental model quickly
- a todo-style application tutorial or equivalent end-to-end example
- documentation that explains the problem being solved before diving into implementation details
- explanations that do not assume deep prior familiarity with local-first architecture, RDF, or Solid Pods
- examples aligned closely with the stable public API
- documentation updates that stay in lockstep with API changes

The `README.md` has a particularly important role. It must:

- explain the problem clearly before the reader disengages
- introduce the value proposition in plain language
- make local-first + Pod-backed sync feel practical rather than academic
- remain concise enough to work as an introduction, not a book

### API Stability and Migration Requirements

API stability is a defining requirement for this product type.

- The public API must be simple enough to remain stable.
- Pre-1.0 changes may still occur, but should be limited and purposeful.
- After `1.0`, the expectation is no breaking changes except under exceptional circumstances.
- Documentation and examples must be updated together with any API evolution.
- Stability should be treated as a product promise, not merely a technical aspiration.

### Implementation Considerations

The product should be shaped so that developers can succeed without needing to think about storage architecture, sync engine design, or RDF internals in their daily workflow. The implementation must therefore privilege:

- boring defaults over flexible but confusing surfaces
- small public abstractions over broad configuration space
- examples that map directly to real developer goals
- a stable package and documentation experience that supports repeated adoption

## Functional Requirements

### Developer Onboarding and Setup

- FR1: Developers can install lofipod in a TypeScript project using the supported package distribution.
- FR2: Developers can use lofipod from JavaScript as well as TypeScript.
- FR3: Developers can initialize lofipod for a local-first application without first configuring remote sync.
- FR4: Developers can connect an application using lofipod to a user's Solid Pod.
- FR5: Developers can follow official documentation to create a working bounded-app example using the public API.

### Entity and Data Operations

- FR6: Developers can define shallow entity types for application data.
- FR7: Applications can create new entities locally.
- FR8: Applications can read previously stored entities locally.
- FR9: Applications can update existing entities locally.
- FR10: Applications can delete entities locally.
- FR11: Applications can list collections of stored entities locally.
- FR12: Applications can work with deterministic entity identity within the supported bounded app class.
- FR13: Applications can perform CRUD operations without requiring direct developer management of sync workflows.
- FR14: Applications can store and retrieve entity data using the documented public API only.

### Local-First Persistence

- FR15: Applications can persist entity data locally for offline-first use.
- FR16: Applications can continue reading and writing supported data while disconnected from the network.
- FR17: Applications can reopen previously stored local data after application restart.
- FR18: Developers can inspect locally stored application data.
- FR19: Developers can inspect the local state relevant to synchronization and migration behavior.

### Pod Connection and Background Synchronization

- FR20: Applications can attach Pod-backed synchronization to locally managed data.
- FR21: lofipod can synchronize supported entity changes to the connected Solid Pod in the background.
- FR22: lofipod can import supported Pod-backed data into the local application state.
- FR23: Applications can continue normal local operation while background synchronization occurs.
- FR24: lofipod can resume synchronization after temporary offline periods.
- FR25: lofipod can bring multiple devices using the same application toward a consistent state for supported scenarios.
- FR26: Developers can inspect the canonical Pod-side data produced by lofipod.
- FR27: lofipod can keep Pod-backed data visible in a reusable RDF form rather than only as app-private state.

### Schema Evolution and Compatibility

- FR28: Developers can evolve the supported entity model over time.
- FR29: lofipod can read data created by an older supported schema version.
- FR30: lofipod can migrate supported existing data to a newer schema version without data loss in supported scenarios.
- FR31: lofipod can preserve synchronization trust when supported schema evolution occurs.
- FR32: Developers can inspect the result of schema migration in local state and Pod-backed state.

### Foreign-Change Detection and Policy Handling

- FR33: lofipod can detect a predefined class of out-of-band Pod-side changes affecting supported data.
- FR34: lofipod can classify whether a detected Pod-side change is safe to import within the supported Phase 1 model.
- FR35: lofipod can safely import Pod-side changes that match the supported entity shape and invariants.
- FR36: lofipod can surface Pod-side changes that are unsupported, ambiguous, or unsafe to merge.
- FR37: lofipod can apply a documented policy response to unsupported or unsafe Pod-side changes.
- FR38: Developers can inspect what foreign change was detected and how lofipod responded to it.
- FR39: lofipod does not require Phase 1 support for arbitrary Pod-side writers or arbitrary RDF mutations.

### Diagnostics and Explainability

- FR40: Developers can inspect logs relevant to local-first state, synchronization activity, and migration behavior.
- FR41: Developers can determine what changed locally, what synchronized, and what did not synchronize.
- FR42: Developers can determine whether a supported migration occurred and what outcome it produced.
- FR43: Developers can determine whether a foreign Pod-side change was imported, rejected, quarantined, or otherwise surfaced by policy.
- FR44: Developers can diagnose supported synchronization interruptions using documented inspection paths.
- FR45: Developers can distinguish between local state, Pod-backed state, and synchronization-related state during troubleshooting.

### Portability and Reuse

- FR46: Developers can inspect application data in the connected Solid Pod outside the originating application.
- FR47: Developers can rely on lofipod to keep canonical Pod-backed data in a form intended for reuse.
- FR48: Developers can build the bounded Phase 1 app class without coupling to hidden internals.
- FR49: Developers can use the same documented capability model across Node and browser environments.
- FR50: The product can grow later toward broader cross-application reuse without redefining the core Phase 1 capability contract.

## Non-Functional Requirements

### Performance

The product must preserve the feel of an ordinary fast local application even when Pod synchronization is enabled.

- Local CRUD interactions for the supported bounded app class must not be blocked by background synchronization activity.
- Normal local reads and writes for the supported personal-data app size must feel immediate and lag-free during ordinary use.
- Synchronization work must remain hidden in the background during supported local interaction rather than becoming a foreground interaction cost.
- Data becoming available from synchronization should appear incrementally as it is safely incorporated, rather than requiring all synchronization work to complete before any usable state is visible.

### Reliability

Reliability is a first-class quality attribute for lofipod and is more important than feature breadth.

- The system must not lose user data in supported scenarios.
- For the supported bounded model, multiple devices must converge to a consistent state after offline/reconnect behavior completes.
- The supported conflict model must be CRDT-light: automatic conflict resolution is required within the documented constraints of simple ordered collections of entities and unordered sets of entities, without claiming general CRDT semantics outside those boundaries.
- Supported conflicts must resolve automatically and predictably within the documented model constraints.
- When a conflict or state condition falls outside supported automatic resolution boundaries, the system must surface that condition explicitly rather than silently corrupting or discarding data.
- Schema migration failures or partial migration conditions must be explicit and inspectable rather than hidden.
- Synchronization interruptions must be recoverable without requiring the user to abandon local-first use.

### Security & Privacy

The product must preserve the local-first and privacy-respecting nature of the system.

- lofipod must not depend on centralized telemetry or centralized data collection for normal operation.
- Credentials, access tokens, and equivalent Pod access secrets must be protected from exposure through normal logs, diagnostics, and user-visible inspection paths.
- Diagnostics must avoid exposing private user content by default unless the developer or user explicitly chooses to export or reveal it.
- The system must preserve the principle that user data remains under user-controlled storage boundaries rather than being silently replicated to centralized service infrastructure.

### Integration Resilience

The product must remain usable in the imperfect conditions of real Pod and network environments.

- Intermittent internet connectivity must not prevent continued supported local use of the application.
- Loss of Pod availability or temporary network failure must degrade to continued local-first behavior rather than application failure.
- When Pod access, authentication, or network conditions prevent synchronization, the system must surface that condition clearly enough for a developer to diagnose it.
- Canonical Pod-backed RDF data must remain inspectable by developers and compatible with the documented bounded model.
- Integration with Pods must tolerate ordinary variability in network and Pod responsiveness without invalidating the local-first user experience.

## Project Scoping & Phased Development

This section defines sequencing and deferral. Capability boundaries are defined in `Product Scope` and the requirement contract is defined in `Functional Requirements` and `Non-Functional Requirements`.

### MVP Strategy & Philosophy

**MVP Approach:** Trust-proof, problem-solving MVP with architecture validation.

Phase 1 is intentionally a trust-proof MVP, not an interoperability-proof MVP. The goal is to prove that lofipod can support one bounded class of real local-first application with SOLID Pod-backed synchronization in a way that is trustworthy, explainable, and stable enough to build on.

**Resource Requirements:** The MVP can begin with a very small team, including a solo builder, but it requires strong capability in TypeScript, local-first architecture, RDF/Solid interoperability, testing discipline, and migration-safe design.

### Phase 1 (MVP)

**Core User Journeys Supported:**

- A developer evaluates lofipod and reaches first proof of value.
- A developer builds a private local-first application that works across multiple devices.
- A developer evolves the model without losing live data.
- A developer understands and diagnoses what the system did after reconnect, migration, or a predefined foreign-change event.

**Phase 1 Exit Criteria:**

- The bounded app class preserves data with no loss in supported scenarios.
- Multiple devices converge to a consistent end state after offline/reconnect.
- One real schema evolution path completes with preserved data.
- One predefined class of external Pod-side mutation is detected and handled with documented semantics.
- The app is built using documented public APIs and supported patterns only.
- Diagnostics or inspectable state are sufficient for a developer to explain sync interruption, migration, and foreign-change behavior.

Phase 1 proves trust under bounded authorship, not general compatibility with arbitrary Pod-side writers or arbitrary RDF mutations.

### Phase 2 (Growth)

Phase 2 proves that lofipod is not only usable for one application, but is a practical shared-data foundation.

Planned growth features:

- multiple applications sharing the same underlying user-owned data
- broader external-change interoperability beyond the bounded MVP foreign-change policy
- harder migration and compatibility scenarios across app surfaces
- stronger examples and demonstrations of interoperability across app surfaces
- more robust privacy-preserving diagnostics and failure recovery support
- clearer proof that independent builders can adopt the same canonical model

### Phase 3 (Expansion)

Phase 3 expands from product proof to ecosystem proof.

Planned expansion features:

- an ecosystem of applications built on top of lofipod
- public showcase examples demonstrating practical Solid Pod usage
- broader recognition of constrained local-first + Pod-backed development as a viable alternative to raw Solid tooling, heavyweight sync systems, and bespoke architectures
- stronger cross-application conventions, documentation, and ecosystem credibility

### Delivery Risks

**Technical Risks:**  
The primary technical risks are sync correctness, model evolution safety, explainability gaps, and ecosystem friction from Solid/RDF tooling variability. These risks should be mitigated by keeping the MVP narrow, making the safety boundary explicit, validating against real applications such as `y-felin`, and requiring evidence-based Phase 1 exit criteria rather than narrative success.

**Market Risks:**  
The main market risk is that lofipod may be perceived either as too narrow to matter or as just another wrapper around existing concepts. The MVP addresses this by proving real developer value under realistic trust conditions, while the Growth phase addresses it by demonstrating broader interoperability and repeated application success rather than one-off novelty.

**Resource Risks:**  
The main resource risk is spreading effort across too many ambitious features before the constrained model is proven. This should be mitigated by keeping Phase 1 tightly aligned with one bounded app class, limiting scope to a single-app multi-device trust proof, and treating broader multi-app interoperability as the first major expansion rather than an assumed Day 1 guarantee.
