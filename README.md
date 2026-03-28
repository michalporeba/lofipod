# lofipod

`lofipod` is a local-first library for building privacy-first applications with
RDF data and SOLID Pod sync.

## Why it exists

There are good JavaScript and TypeScript tools for browser storage, and there
are good tools for authenticating with and reading from SOLID Pods, but there
is still a gap between the two.

Most local-first libraries do not target SOLID Pods as a durable backing store,
and most Solid tooling does not provide a mature local-first sync engine with
an application-facing developer experience.

`lofipod` is intended to explore that missing middle ground.

## What it aims to offer

- local-first persistence for browser applications
- privacy-first products that remain usable offline
- SOLID Pod backing and multi-device synchronisation
- RDF data that remains interoperable outside the application
- background sync without a user-facing sync button
- a framework-agnostic core that can later be wrapped for React or other UI
  libraries

## What it is not

- realtime collaborative editing like Google Docs
- a general-purpose RDF database
- a general sync framework for arbitrary object graphs
- a full application framework

## Who it is for

`lofipod` is aimed at application developers who want:

- local-first behaviour as the default
- user-controlled or portable data through SOLID Pods
- RDF as an interoperability boundary
- a small core they can understand and build on

It is not aimed at applications that need rich collaborative editing or a fully
general graph sync engine.

## Status

There is no implementation yet. The current state of the project is the initial
definition of the problem, constraints, public API direction, and development
plan.

See:

- `ADR.md` for accepted architectural principles and constraints
- `API.md` for the current public API design draft
- `PLANS.md` for the first implementation slices derived from that API
