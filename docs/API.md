# API

## Status

Working draft for the public `lofipod` API.

This document describes the current developer-facing API shape and the intended
developer experience. It is not an accepted architecture record.
[ADR.md](ADR.md) remains the source of truth for accepted constraints.

## What the API is trying to do

The public API is designed around a simple idea:

- your application owns its TypeScript entity types
- `lofipod` owns local-first storage, change tracking, and sync orchestration
- each entity definition owns its RDF mapping
- normal CRUD should feel local first
- SOLID Pod sync should be available without making ordinary reads and writes
  feel remote-driven

This means the API should stay small, explicit, and framework-agnostic.

## API in one minute

Most applications use `lofipod` like this:

1. define the RDF vocabulary terms your app uses
2. define one or more entity types with `toRdf(...)` and `project(...)`
3. create an engine
4. save, get, list, and delete entities locally
5. add browser or Node persistence
6. attach SOLID Pod sync when you want remote durability and replication

The Pod is the durable remote store.
The client-local store is still the main place your app reads from.

## Minimal local example

This example stays local on purpose. It shows the core API without adding
browser persistence or Pod sync yet.

```ts
import {
  createEngine,
  createMemoryStorage,
  defineEntity,
  defineVocabulary,
  literal,
  objectOf,
  rdf,
  stringValue,
} from "lofipod";

const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Task: "ns#Task",
    title: "ns#title",
    status: "ns#status",
    due: "ns#due",
    edtf: "ns#edtf",
    Todo: "ns#Todo",
    Done: "ns#Done",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`;
  },
});

type Task = {
  id: string;
  title: string;
  status: "todo" | "done";
  due?: string;
};

function statusToTerm(task: Task) {
  return task.status === "done" ? ex.Done : ex.Todo;
}

function termToStatus(value: ReturnType<typeof objectOf>): Task["status"] {
  if (!value || typeof value === "string") {
    throw new Error("Task status must be an RDF named node.");
  }

  if (value.value === ex.Todo.value) {
    return "todo";
  }

  if (value.value === ex.Done.value) {
    return "done";
  }

  throw new Error(`Unsupported task status term: ${value.value}`);
}

function idFromExampleTaskUri(subject: { value: string }): string {
  // This example's URI factory keeps the task ID in the final path segment.
  return subject.value.split("/").at(-1) ?? "";
}

const TaskEntity = defineEntity<Task>({
  kind: "task",
  pod: {
    basePath: "tasks/",
  },
  rdfType: ex.Task,
  id: (task) => task.id,
  uri: (task) =>
    ex.uri({
      entityName: "task",
      id: task.id,
    }),
  toRdf(task, { uri }) {
    const subject = uri(task);

    return [
      [subject, rdf.type, ex.Task],
      [subject, ex.title, task.title],
      [subject, ex.status, statusToTerm(task)],
      ...(task.due ? [[subject, ex.due, literal(task.due, ex.edtf)]] : []),
    ];
  },
  project(graph, { uri }) {
    const subject = uri();

    return {
      id: idFromExampleTaskUri(subject),
      title: stringValue(graph, subject, ex.title),
      status: termToStatus(objectOf(graph, subject, ex.status)),
      due:
        typeof objectOf(graph, subject, ex.due) === "string"
          ? String(objectOf(graph, subject, ex.due))
          : undefined,
    };
  },
});

const engine = createEngine({
  entities: [TaskEntity],
  storage: createMemoryStorage(),
});

await engine.save("task", {
  id: "task-1",
  title: "Write docs",
  status: "todo",
  due: "2026-04",
});

const task = await engine.get<Task>("task", "task-1");
const tasks = await engine.list<Task>("task", { limit: 20 });
await engine.delete("task", "task-1");
```

What this example shows:

- the application owns the `Task` type
- the entity definition owns RDF mapping and Pod placement for a bounded
  todo-style task
- the engine owns local CRUD behaviour
- `project(...)` rebuilds the application object from canonical graph state

## Adding persistence and sync

The same API can use browser or Node storage, and sync can be configured when
the engine is created or attached later.

```ts
import { createEngine } from "lofipod";
import { createIndexedDbStorage, createSolidPodAdapter } from "lofipod/browser";

const engine = createEngine({
  pod: {
    logBasePath: "apps/my-app/log/",
    podBaseUrl,
  },
  entities: [TaskEntity],
  storage: createIndexedDbStorage({
    databaseName: "my-app",
  }),
  sync: {
    adapter: createSolidPodAdapter({ podBaseUrl, authorization }),
    pollIntervalMs: 30_000,
  },
});
```

You can also attach sync later:

```ts
await engine.sync.attach({
  adapter: createSolidPodAdapter({ podBaseUrl, authorization }),
  podBaseUrl,
  logBasePath: "apps/my-app/log/",
  pollIntervalMs: 30_000,
});
```

In normal use:

- `save(...)`, `get(...)`, `list(...)`, and `delete(...)` still operate through
  the local store
- attached sync runs in the background
- `engine.sync.now()` is available, but manual sync is not meant to be the
  normal application flow

## Current public surface

The current public API is intentionally small and explicit.

### Definition and engine

- `defineVocabulary(...)`
- `defineEntity<T>(...)`
- `createEngine(...)`

### Storage and adapters

- `createMemoryStorage(...)`
- `createIndexedDbStorage(...)` from `lofipod/browser`
- `createSqliteStorage(...)` from `lofipod/node`
- `createSolidPodAdapter(...)` from `lofipod/browser` or `lofipod/node`

### Engine CRUD

- `engine.save(entityKind, entity)`
- `engine.get(entityKind, id)`
- `engine.list(entityKind, options?)`
- `engine.delete(entityKind, id)`
- `engine.dispose()`

### Sync surface

- `engine.sync.attach(config)`
- `engine.sync.detach()`
- `engine.sync.persistedConfig()`
- `engine.sync.state()`
- `engine.sync.onStateChange(callback)`
- `engine.sync.now()`
- `engine.sync.bootstrap()`

### RDF helpers

- `uri(...)`
- `literal(...)`
- `objectOf(...)`
- `stringValue(...)`
- `numberValue(...)`
- `booleanValue(...)`
- `blankNode(...)`
- `namedNode(...)`
- `rdf`

### Optional engine features

- `logger` on `createEngine(...)`

There is currently no general entity observation API.
The current observation surface is limited to sync-state changes.

## `defineEntity<T>(...)`

Each entity definition should describe one application entity type and how it
maps to RDF.

Required fields:

- `kind`
- `pod.basePath`
- `rdfType`
- `id(entity)`
- `toRdf(entity, helpers)`
- `project(graph, helpers)`

Optional field:

- `uri(entity)`

In practice:

- `kind` is the stable machine identifier used with `engine.save(...)`,
  `engine.get(...)`, and `engine.list(...)`
- `pod.basePath` defines where canonical resources for that entity type live in
  the Pod
- `rdfType` declares the main RDF class for the entity
- `id(...)` returns the application-level identity
- `toRdf(...)` returns the full canonical triple set for one entity
- `project(...)` turns that canonical graph back into an application object

Current assumptions:

- identity lives on the entity object in v0
- RDF mapping is owned per entity, not globally
- `toRdf(...)` should be pure
- `project(...)` should be pure
- the graph is the canonical local and remote state
- the object returned by `project(...)` is an application projection of that
  graph

For embedded one-to-one structures, helpers such as `child("time")` are
available when a stable child node is needed.

## `createEngine(...)`

`createEngine(...)` is the main runtime entrypoint.

Current config shape:

- `entities`: required
- `storage`: optional
- `logger`: optional
- `pod`: optional
- `sync`: optional

Notes:

- if `storage` is omitted, the engine uses in-memory storage
- `entities` must have unique `kind` values
- `pod.logBasePath` configures the app-private replication log root
- `pod.podBaseUrl` may also be provided
- `sync.adapter` enables remote sync
- `sync.pollIntervalMs` is optional

The engine API is intentionally narrow:

- save one entity
- get one entity by ID
- list entities of one kind
- delete one entity
- inspect and control sync separately when needed

This is not meant to be a rich query engine or schema DSL.

## Sync and connection surface

Sync should be visible, but secondary to CRUD.

The current sync surface supports:

- attaching sync at engine creation time or later with `engine.sync.attach(...)`
- detaching sync at runtime with `engine.sync.detach()`
- reading persisted Pod config with `engine.sync.persistedConfig()`
- inspecting aggregate sync state with `engine.sync.state()`
- subscribing to sync-state changes with `engine.sync.onStateChange(...)`
- explicitly triggering a sync cycle with `engine.sync.now()`
- bootstrapping local state from canonical remote resources with
  `engine.sync.bootstrap()`

`engine.sync.bootstrap()` currently returns:

- `imported`: remote-only entities imported locally
- `skipped`: graph-identical entities skipped
- `reconciled`: supported bounded mixed-state entities auto-merged
- `unsupported`: mixed-state entities surfaced as unsupported/unsafe
- `collisions`: compatibility list of unresolved unsupported entities

Important behaviour:

- local saves and deletes complete locally before remote sync
- attached sync runs automatically after save and delete
- attaching sync also queues background sync work
- periodic polling is the reliability backstop
- notifications are an optimization path, not a correctness dependency
- manual sync should not be the normal application flow

The current `SyncState` reports aggregate engine-level status:

- `status`: `"unconfigured" | "offline" | "syncing" | "idle" | "pending"`
- `configured`
- `pendingChanges`
- `reconciliation.lastUnsupportedPolicy`
- `reconciliation.lastUnsupportedReason`
- `connection.reachable`
- `connection.lastSyncedAt`
- `connection.lastFailedAt`
- `connection.lastFailureReason`
- `connection.notificationsActive`

When omitted, the current default polling interval is 30 seconds, with
exponential backoff after consecutive sync failures.

## Local storage and listing

The current local persistence model is intentionally simple:

- storage is adapter-driven and library-managed
- the library persists projected entities, canonical graphs, and sync metadata
- local layout stays internal to the library

The current listing API is also intentionally narrow:

- list by entity kind
- default newest first ordering
- optional `limit`
- no rich filtering or general query DSL yet

## Logging

The engine may accept an optional logger with the shape:

- `debug(message, metadata?)`
- `info(message, metadata?)`
- `warn(message, metadata?)`
- `error(message, metadata?)`

When provided, the current implementation logs:

- Pod HTTP requests as `pod:request`
- sync phase timings such as `sync:push`, `sync:pull`, `sync:reconcile`, and
  `sync:cycle`
- operational events such as `sync:attached`, `sync:detached`, and
  `sync:bootstrap`
- unsupported canonical reconciliation events as
  `sync:reconcile:unsupported`, including bounded-policy metadata
  (`policy: "preserve-local-skip-unsupported-remote"`) and classification
  reason

When omitted, logging adds no meaningful work beyond the normal code paths.

## Defaults and current limits

Current defaults:

- identity is part of the entity object
- per-entity RDF codecs are the default mapping mechanism
- public vocabulary terms and URI helpers are `NamedNode`-based
- per-entity Pod base paths are supported
- local persistence is adapter-driven
- sync state is inspectable, but CRUD remains the primary experience
- bootstrap from canonical Pod resources is explicit rather than automatic

Current limits:

- no full query system
- no rich schema DSL
- no general entity observation API yet
- listing is intentionally narrow
- conflict and branch state are not yet fully surfaced as a public API

## Open points

Still open in the API direction:

- the exact helper set exposed to `project(...)`
- the exact list and cursor API beyond basic newest-first listing
- what framework-agnostic observation API should exist before React bindings
- how conflict and branch state should eventually appear in the public API
