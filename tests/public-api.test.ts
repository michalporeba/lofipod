import { describe, expect, it } from "vitest";

import {
  createEngine,
  defineEntity,
  defineVocabulary,
  packageVersion,
  rdf,
  type Triple,
} from "../src/index.js";

describe("public API scaffold", () => {
  it("exposes the initial package version", () => {
    expect(packageVersion).toBe("0.1.0");
  });

  it("provides standard RDF terms", () => {
    expect(rdf.type).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
  });
});

describe("defineVocabulary", () => {
  it("expands named terms against the base IRI", () => {
    const ex = defineVocabulary({
      base: "https://example.com/",
      terms: {
        Event: "ns#Event",
        title: "ns#title",
      },
      uri({ base, entityName, id }) {
        return `${base}id/${entityName}/${id}`;
      },
    });

    expect(ex.Event).toBe("https://example.com/ns#Event");
    expect(ex.title).toBe("https://example.com/ns#title");
  });

  it("binds the base IRI into the vocabulary uri factory", () => {
    const ex = defineVocabulary({
      base: "https://example.com/",
      terms: {
        Event: "ns#Event",
      },
      uri({ base, entityName, id }) {
        return `${base}id/${entityName}/${id}`;
      },
    });

    expect(ex.uri({ entityName: "event", id: "ev-123" })).toBe(
      "https://example.com/id/event/ev-123",
    );
  });
});

describe("defineEntity", () => {
  it("keeps entity configuration together with pure RDF projection logic", () => {
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

    const entity = defineEntity<Event>({
      name: "event",
      pod: {
        basePath: "events/",
      },
      rdfType: ex.Event,
      id: (event) => event.id,
      toRdf(event, { uri, child }) {
        const subject = uri(event);
        const time = child("time");

        return [
          [subject, rdf.type, ex.Event],
          [subject, ex.title, event.title],
          [subject, ex.time, time],
          [time, ex.year, event.time.year],
        ] satisfies Triple[];
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

    expect(entity.name).toBe("event");
    expect(entity.pod.basePath).toBe("events/");
    expect(entity.rdfType).toBe(ex.Event);
  });

  it("supports path-based child nodes for embedded one-to-one structures", () => {
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

    const entity = defineEntity<Event>({
      name: "event",
      pod: {
        basePath: "events/",
      },
      rdfType: ex.Event,
      id: (event) => event.id,
      toRdf(event, { uri, child }) {
        const subject = uri(event);
        const time = child("time");

        return [
          [subject, rdf.type, ex.Event],
          [subject, ex.title, event.title],
          [subject, ex.time, time],
          [time, ex.year, event.time.year],
        ] satisfies Triple[];
      },
      project(graph, { uri, child }) {
        const subject = uri();
        const time = child("time");

        return {
          id: subject.split("/").at(-1) ?? "",
          title: String(
            graph.find(
              ([subjectTerm, predicateTerm]) =>
                subjectTerm === subject && predicateTerm === ex.title,
            )?.[2] ?? "",
          ),
          time: {
            year: Number(
              graph.find(
                ([subjectTerm, predicateTerm]) =>
                  subjectTerm === time && predicateTerm === ex.year,
              )?.[2] ?? 0,
            ),
          },
        };
      },
    });

    const event = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    const helpers = {
      uri(currentEvent: Event) {
        return ex.uri({
          entityName: entity.name,
          id: entity.id(currentEvent),
        });
      },
      child(path: string) {
        return `child:${path}`;
      },
    };

    const graph = entity.toRdf(event, helpers);

    expect(graph).toEqual<Triple[]>([
      [ex.uri({ entityName: "event", id: "ev-123" }), rdf.type, ex.Event],
      [ex.uri({ entityName: "event", id: "ev-123" }), ex.title, "Hello"],
      [ex.uri({ entityName: "event", id: "ev-123" }), ex.time, "child:time"],
      ["child:time", ex.year, 2024],
    ]);

    const projected = entity.project(graph, {
      uri() {
        return ex.uri({ entityName: "event", id: "ev-123" });
      },
      child(path: string) {
        return `child:${path}`;
      },
    });

    expect(projected).toEqual(event);
  });
});

describe("createEngine", () => {
  const createEventFixture = () => {
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

    const entity = defineEntity<Event>({
      name: "event",
      pod: {
        basePath: "events/",
      },
      rdfType: ex.Event,
      id: (event) => event.id,
      toRdf(event, { uri, child }) {
        const subject = uri(event);
        const time = child("time");

        return [
          [subject, rdf.type, ex.Event],
          [subject, ex.title, event.title],
          [subject, ex.time, time],
          [time, ex.year, event.time.year],
        ] satisfies Triple[];
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

    return { entity };
  };

  it("saves one entity and reads it back through the public API", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    const input = {
      id: "ev-123",
      title: "Hello",
      time: {
        year: 2024,
      },
    };

    await engine.save("event", input);

    await expect(engine.get("event", "ev-123")).resolves.toEqual(input);
  });

  it("overwrites an entity by replacing its canonical graph", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await engine.save("event", {
      id: "ev-123",
      title: "First",
      time: {
        year: 2024,
      },
    });

    await engine.save("event", {
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });

    await expect(engine.get("event", "ev-123")).resolves.toEqual({
      id: "ev-123",
      title: "Updated",
      time: {
        year: 2025,
      },
    });
  });

  it("returns null when an entity is not present", async () => {
    const { entity } = createEventFixture();
    const engine = createEngine({
      entities: [entity],
    });

    await expect(engine.get("event", "missing")).resolves.toBeNull();
  });
});
