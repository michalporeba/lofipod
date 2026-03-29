# Quick Start

This guide shows the smallest useful `lofipod` flow:

1. define a vocabulary
2. define one entity type
3. create an engine
4. save and read one entity

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
  rdf,
} from "lofipod";

const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Event: "ns#Event",
    title: "ns#title",
    time: "ns#time",
    year: "ns#year",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`;
  },
});

type Event = {
  id: string;
  title: string;
  time: {
    year: number;
  };
};

const EventEntity = defineEntity<Event>({
  name: "event",
  pod: {
    basePath: "events/",
  },
  rdfType: ex.Event,
  id: (event) => event.id,
  uri: (event) =>
    ex.uri({
      entityName: "event",
      id: event.id,
    }),

  toRdf(event, { uri, child }) {
    const subject = uri(event);
    const time = child("time");

    return [
      [subject, rdf.type, ex.Event],
      [subject, ex.title, event.title],
      [subject, ex.time, time],
      [time, ex.year, event.time.year],
    ];
  },

  project(graph, { uri, child }) {
    const subject = uri();
    const time = child("time");
    const objectOf = (target: string, predicate: string) =>
      graph.find(
        ([subjectTerm, predicateTerm]) =>
          subjectTerm === target && predicateTerm === predicate,
      )?.[2];

    return {
      id: subject.split("/").at(-1) ?? "",
      title: String(objectOf(subject, ex.title) ?? ""),
      time: {
        year: Number(objectOf(time, ex.year) ?? 0),
      },
    };
  },
});

const engine = createEngine({
  entities: [EventEntity],
  storage: createMemoryStorage(),
});

await engine.save("event", {
  id: "ev-123",
  title: "Hello",
  time: {
    year: 2024,
  },
});

const event = await engine.get<Event>("event", "ev-123");
const events = await engine.list<Event>("event");

console.log(event);
console.log(events);
```

## What this proves

- the application owns the TypeScript entity shape
- the entity definition owns RDF mapping and Pod placement
- local reads and writes go through the engine API
- `project(...)` rebuilds objects from canonical graph state

## Next steps

- see [API.md](API.md) for the broader API direction
- see [ADR.md](ADR.md) for architectural decisions
- swap `createMemoryStorage()` for `createIndexedDbStorage(...)` in browser use
