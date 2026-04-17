# Quick Start

This guide shows the smallest useful `lofipod` flow.

You will:

1. define one small entity type
2. map it to RDF
3. create a local engine
4. save and read data through the public API

This example stays local on purpose. It shows the core model first, without
adding browser persistence or Pod sync yet.

## What you are building

A tiny local task store with one entity:

- `Task { id, title, done }`

## Install

```bash
npm install lofipod
```

## Example

```ts
import {
  booleanValue,
  createEngine,
  createMemoryStorage,
  defineEntity,
  defineVocabulary,
  rdf,
  stringValue,
} from "lofipod";

const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Task: "ns#Task",
    title: "ns#title",
    done: "ns#done",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`;
  },
});

type Task = {
  id: string;
  title: string;
  done: boolean;
};

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
      [subject, ex.done, task.done],
    ];
  },
  project(graph, { uri }) {
    const subject = uri();

    return {
      id: subject.value.split("/").at(-1) ?? "",
      title: stringValue(graph, subject, ex.title),
      done: booleanValue(graph, subject, ex.done),
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
  done: false,
});

const task = await engine.get<Task>("task", "task-1");
const tasks = await engine.list<Task>("task");

console.log(task);
console.log(tasks);
```

Expected result:

```ts
task;
// { id: "task-1", title: "Write docs", done: false }

tasks;
// [{ id: "task-1", title: "Write docs", done: false }]
```

## What each part does

- `defineVocabulary(...)` declares the RDF terms used by this app.
- `defineEntity(...)` tells `lofipod` how a `Task` becomes RDF and back again.
- `createEngine(...)` creates the local-first API surface.
- `engine.save(...)`, `engine.get(...)`, and `engine.list(...)` are the normal
  app-facing operations.

## What this shows

- the application owns the TypeScript entity shape
- RDF mapping is explicit, but still small
- local reads and writes go through the engine API
- `project(...)` rebuilds an object from canonical graph state
- normal app queries stay local

## Next steps

- swap `createMemoryStorage()` for `createIndexedDbStorage(...)` from
  `lofipod/browser` when you want browser persistence
- attach a Solid Pod adapter when you want remote durability and background
  sync
- see [API.md](API.md) for the broader public API direction
- see [ADR.md](ADR.md) for accepted architectural decisions
