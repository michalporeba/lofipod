# TARGET API

This document captures the current target shape of the `lofipod` public API at
this stage of the design process. It is intentionally narrower and more example
driven than `API.md`.

## Current direction

The current design preference is:

- keep the API small and explicit
- prefer pure functions over mutation-based builders
- make RDF mapping visible rather than hiding it behind a heavy abstraction
- keep entity configuration, Pod placement, and identity rules together in
  `defineEntity<T>(...)`
- make vocabulary helpers explicit and reusable without requiring proxy magic
- treat entity graphs as canonical and application objects as projections

## Example

```ts
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

    return {
      id: subject.value.split("/").at(-1) ?? "",
      title: stringValue(graph, subject, ex.title),
      time: {
        year: numberValue(graph, time, ex.year),
      },
    };
  },
});
```

## Current function shapes

```ts
toRdf(entity, helpers) => Triple[]
project(graph, helpers) => entity
```

Where:

- `toRdf(...)` takes an application object and returns the full canonical RDF
  triple set for that entity
- `project(...)` takes the canonical graph for one entity and returns a full
  projected object
- `child(path)` returns a stable graph-local node for a parent-owned embedded
  structure such as `child("time")`

Expanded sketch:

```ts
type Triple = [
  subject: NamedNode | BlankNode,
  predicate: NamedNode,
  object: RdfTerm | string | number | boolean,
];

type ToRdfHelpers<T> = {
  uri(entity: T): NamedNode;
  child(path: string): NamedNode;
};

type ProjectionHelpers = {
  uri(): NamedNode;
  child(path: string): NamedNode;
};
```

## Notes

- `toRdf(...)` should remain pure.
- `toRdf(...)` should return RDF triples rather than mutating external state.
- `project(...)` should remain pure and return a full projected object.
- The `uri(...)` helper passed to `toRdf(...)` should be derived from the
  vocabulary and entity definition so the entity name and ID rules do not need
  to be repeated in every codec.
- `project(...)` is preferred over `fromGraph(...)` because the graph is the
  canonical state and the object is a projection.
- `rdfType` belongs on the entity definition, not on each entity instance, for
  the simple single-class case.
- Public helper values such as `uri(...)`, `literal(...)`, `objectOf(...)`,
  `stringValue(...)`, and `numberValue(...)` are part of the current API
  surface.
