# Quick Start

This guide shows the smallest useful `lofipod` flow.

You will:

1. define one small entity type
2. map it to RDF
3. create a local engine
4. save and read data through the public API

This example stays local on purpose. It shows the core model first, without
adding browser persistence or Pod sync yet.

Use the root `lofipod` entrypoint for this example. Browser-only and Node-only
adapters come later from `lofipod/browser` and `lofipod/node`.

## What you are building

A tiny local task store with one entity:

- `Task { id, title, status, due? }`

## Install

```bash
npm install lofipod
```

## Example

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
const tasks = await engine.list<Task>("task");

console.log(task);
console.log(tasks);
await engine.delete("task", "task-1");
```

Expected result:

```ts
task;
// { id: "task-1", title: "Write docs", status: "todo", due: "2026-04" }

tasks;
// [{ id: "task-1", title: "Write docs", status: "todo", due: "2026-04" }]
```

## What each part does

- `defineVocabulary(...)` declares the RDF terms used by this app.
- `defineEntity(...)` tells `lofipod` how a bounded todo-style `Task` becomes RDF and back again.
- `createEngine(...)` creates the local-first API surface.
- `engine.save(...)`, `engine.get(...)`, `engine.list(...)`, and
  `engine.delete(...)` are the normal app-facing operations.

## What this shows

- the application owns the TypeScript entity shape
- RDF mapping is explicit, but the example keeps it behind a small app-owned vocabulary
- local reads and writes go through the engine API
- `project(...)` rebuilds an object from canonical graph state
- normal app queries stay local

## Next steps

- use the in-repo demo from [../demo/README.md](../demo/README.md) if you want
  an exact local-first CLI flow without reading source files
- swap `createMemoryStorage()` for `createIndexedDbStorage(...)` from
  `lofipod/browser` when you want browser persistence
- use `createSqliteStorage(...)` from `lofipod/node` when you want Node-backed
  persistence
- attach a Solid Pod adapter when you want remote durability and background
  sync
- see [API.md](API.md) for the broader public API direction
- see [ADR.md](ADR.md) for accepted architectural decisions
