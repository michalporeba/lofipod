# ADR

## Status

Accepted as the initial architecture and constraints record for `lofipod`.

## Purpose

This document captures the current technical decisions, deliberate constraints,
and known boundaries for the project.

## Accepted decisions

### Positioning

- `lofipod` is a local-first, minimal ("lo-fi") SOLID Pod sync engine.
- The first target is browser-based TypeScript applications.
- The core should be framework-agnostic.
- React support should come later as optional bindings rather than as a core
  dependency.

### Language and packaging

- The project should be implemented in TypeScript.
- The published package should be consumable from plain JavaScript projects.
- Types are part of the developer experience, but not required of consumers.

### Data model

- The supported model is intentionally narrow.
- Entities are shallow objects.
- Supported property kinds are:
  - primitive scalar values
  - opaque atomic values for nested objects or small collections
  - optional unordered primitive-value sets
- Ordered replicated collections are out of scope for the core model.
- Deep graph merge semantics are out of scope.

### Local-first storage

- Local storage should use an append-only transaction log.
- The engine should maintain a materialized local read model.
- Normal reads should use the materialized read model, not replay the raw log
  on every access.
- Saves should compare against the current materialized object and emit new
  messages into the transaction log.

### SOLID Pod backing

- SOLID Pods are the durable backing store and sync target.
- Pod storage should use mutable metadata and index resources for efficient
  reads.
- Canonical entity history in the Pod should be append-only immutable revisions.
- The initial Pod shape should use:
  - top-level meta or manifest
  - bucketed mutable indexes
  - immutable revision resources
- Bucket and index design exists partly for efficient partial loading, not only
  semantic modeling.

### Synchronisation

- Background sync should be expected on save, startup, focus, reconnect, and
  periodic polling.
- Manual sync should not be required for normal operation.
- Solid notifications are an enhancement path, not a baseline dependency.
- Concurrent branches should be preserved rather than discarded.
- One branch may be chosen as current automatically for normal reads.
- Realtime collaborative editing is out of scope.

### Reliability and testing

- Reliability is a first-class project goal.
- TDD should be used where practical.
- Automated tests should focus on externally visible behaviour through the
  public API.
- Most tests should use mocks or fakes so CI remains fast and deterministic.
- Integration tests should run against Inrupt's Community Solid Server in local
  Docker.

## Constraints

- Do not assume there is an off-the-shelf JS/TS library that already solves
  local-first sync with SOLID Pods well enough.
- The project should stay minimal rather than expanding into a general sync
  framework for arbitrary RDF graphs.
- Any internal design should remain compatible with RDF serialization at the
  Pod boundary.

## Open questions

- What exact message vocabulary should the transaction log use?
- Should Pod revisions store full-entity snapshots only, or shallow property
  patches?
- What should the first public API look like in detail?
- How should branch/conflict state be exposed to consumers?
- How far should unordered primitive sets go in the RDF mapping?
