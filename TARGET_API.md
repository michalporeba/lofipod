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

## Example

```ts
const ex = defineVocabulary({
  base: "https://example.com/",
  terms: {
    Event: "ns#Event",
  },
  uri({ base, entityName, id }) {
    return `${base}id/${entityName}/${id}`
  },
})

const EventEntity = defineEntity<Event>({
  name: "event",
  pod: {
    basePath: "events/",
  },
  rdfType: ex.Event,
  id: (event) => event.id,
  toRdf(event, { uri }) {
    return [
      [uri(event), rdf.type, ex.Event],
    ]
  },
})
```

## Notes

- `toRdf(...)` should remain pure.
- `toRdf(...)` should return RDF data rather than mutating external state.
- The `uri(...)` helper passed to `toRdf(...)` should be derived from the
  vocabulary and entity definition so the entity name and ID rules do not need
  to be repeated in every codec.
- `rdfType` belongs on the entity definition, not on each entity instance, for
  the simple single-class case.
- The exact shape of `defineVocabulary(...)`, `toRdf(...)` return values, and
  any matching `fromRdf(...)` API are still open.
