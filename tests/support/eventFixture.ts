import {
  defineEntity,
  defineVocabulary,
  numberValue,
  objectOf,
  rdf,
  stringValue,
} from "../../src/index.js";
import type { EntityDefinition, Triple } from "../../src/index.js";

export type Event = {
  id: string;
  title: string;
  time: {
    year: number;
  };
};

export type EventWithDetails = {
  id: string;
  title: string;
  description?: string;
  time: {
    year: number;
  };
};

export function createEventFixture(): { entity: EntityDefinition<Event> } {
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

  const entity = defineEntity<Event>({
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
      ] satisfies Triple[];
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

  return { entity };
}

export function createEventWithDetailsFixture(): {
  entity: EntityDefinition<EventWithDetails>;
} {
  const ex = defineVocabulary({
    base: "https://example.com/",
    terms: {
      Event: "ns#Event",
      title: "ns#title",
      description: "ns#description",
      time: "ns#time",
      year: "ns#year",
    },
    uri({ base, entityName, id }) {
      return `${base}id/${entityName}/${id}`;
    },
  });

  const entity = defineEntity<EventWithDetails>({
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
        ...(event.description
          ? ([[subject, ex.description, event.description]] satisfies Triple[])
          : []),
        [subject, ex.time, time],
        [time, ex.year, event.time.year],
      ];
    },
    project(graph, { uri, child }) {
      const subject = uri();
      const time = child("time");
      const description = objectOf(graph, subject, ex.description);

      return {
        id: subject.value.split("/").at(-1) ?? "",
        title: stringValue(graph, subject, ex.title),
        description: typeof description === "string" ? description : undefined,
        time: {
          year: numberValue(graph, time, ex.year),
        },
      };
    },
  });

  return { entity };
}
