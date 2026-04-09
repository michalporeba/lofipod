import { describe, expect, it } from "vitest";

import {
  blankNode,
  literal,
  readAttachedInternalTriples,
  uri,
} from "../src/rdf.js";
import {
  createSolidPodAdapter,
  parseLogEntryNTriples,
} from "../src/pod/solid.js";
import type { PodLogAppendRequest } from "../src/types.js";

const RDF_TYPE = uri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const XSD_INTEGER = uri("http://www.w3.org/2001/XMLSchema#integer");

describe("Solid pod adapter", () => {
  it("parses canonical Turtle with prefixes, multiline literals, datatypes, and blank nodes", async () => {
    const adapter = createSolidPodAdapter({
      podBaseUrl: "https://pod.example/",
      fetch: async (input) => {
        const url = String(input);

        if (url === "https://pod.example/events/") {
          return new Response(
            [
              "@prefix ldp: <http://www.w3.org/ns/ldp#>.",
              "",
              "<> ldp:contains",
              "  <event-1.ttl>,",
              "  <notes.txt>.",
            ].join("\n"),
            { status: 200 },
          );
        }

        if (url === "https://pod.example/events/event-1.ttl") {
          return new Response(
            [
              "@prefix ex: <https://example.com/ns#>.",
              "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.",
              "@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.",
              "",
              "<https://example.com/id/event/event-1>",
              "  rdf:type ex:Event ;",
              '  ex:title """Hello',
              'world"""@en ;',
              '  ex:count "42"^^xsd:integer ;',
              "  ex:time _:time .",
              "",
              '_:time ex:label "Nested node" ;',
              "  ex:active true .",
            ].join("\n"),
            { status: 200 },
          );
        }

        return new Response("not found", { status: 404 });
      },
    });

    const entities = await adapter.listCanonicalEntities?.({
      entityName: "event",
      basePath: "events/",
      rdfType: uri("https://example.com/ns#Event"),
    });

    expect(entities).toHaveLength(1);
    expect(entities?.[0]?.entityId).toBe("event-1");
    expect(entities?.[0]?.rootUri).toBe("https://example.com/id/event/event-1");
    expect(entities?.[0]?.graph).toContainEqual([
      uri("https://example.com/id/event/event-1"),
      RDF_TYPE,
      uri("https://example.com/ns#Event"),
    ]);
    expect(entities?.[0]?.graph).toContainEqual([
      uri("https://example.com/id/event/event-1"),
      uri("https://example.com/ns#count"),
      42,
    ]);

    const nestedNode = entities?.[0]?.graph.find(
      ([, predicate]) => predicate.value === "https://example.com/ns#time",
    )?.[2];
    const internalTriples = entities?.[0]?.graph
      ? readAttachedInternalTriples(entities[0].graph)
      : null;
    const internalTimeNode = internalTriples?.find(
      ([, predicate]) => predicate.value === "https://example.com/ns#time",
    )?.[2];

    expect(nestedNode).toMatchObject({
      termType: "BlankNode",
    });
    expect(internalTimeNode).toMatchObject({
      termType: "BlankNode",
    });
    expect(internalTriples).toContainEqual([
      uri("https://example.com/id/event/event-1"),
      uri("https://example.com/ns#title"),
      literal("Hello\nworld", "en"),
    ]);
    expect(internalTriples).toContainEqual([
      uri("https://example.com/id/event/event-1"),
      uri("https://example.com/ns#count"),
      literal("42", XSD_INTEGER),
    ]);
    expect(internalTriples).toContainEqual([
      expect.objectContaining({
        termType: "BlankNode",
        value: (internalTimeNode as { value?: string } | undefined)?.value,
      }),
      uri("https://example.com/ns#label"),
      literal("Nested node"),
    ]);
  });

  it("writes N-Triples replication logs that round-trip through the parser", async () => {
    const writes: Array<{
      url: string;
      contentType: string | null;
      body: string;
    }> = [];
    const adapter = createSolidPodAdapter({
      podBaseUrl: "https://pod.example/",
      fetch: async (input, init) => {
        const url = String(input);

        if (init?.method === "POST") {
          return new Response("", { status: 201 });
        }

        if (init?.method === "PUT") {
          writes.push({
            url,
            contentType:
              init.headers instanceof Headers
                ? init.headers.get("Content-Type")
                : new Headers(init.headers).get("Content-Type"),
            body: String(init.body ?? ""),
          });
          return new Response("", { status: 201 });
        }

        return new Response("unexpected", { status: 500 });
      },
    });
    const request: PodLogAppendRequest = {
      entityName: "event",
      entityId: "ev-123",
      changeId: "change-1",
      parentChangeId: "change-0",
      timestamp: "2026-04-09T12:00:00.000Z",
      path: "apps/my-journal/log/event/change-1.nt",
      rootUri: "https://example.com/id/event/ev-123",
      assertions: [
        [
          uri("https://example.com/id/event/ev-123"),
          uri("https://example.com/ns#title"),
          literal("Hello", "en"),
        ],
        [
          uri("https://example.com/id/event/ev-123"),
          uri("https://example.com/ns#time"),
          blankNode("time"),
        ],
        [blankNode("time"), uri("https://example.com/ns#year"), 2024],
      ],
      retractions: [
        [
          uri("https://example.com/id/event/ev-123"),
          uri("https://example.com/ns#archived"),
          false,
        ],
      ],
    };

    await adapter.appendLogEntry(request);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.url).toBe(
      "https://pod.example/apps/my-journal/log/event/change-1.nt",
    );
    expect(writes[0]?.contentType).toBe("application/n-triples");
    expect(writes[0]?.body).not.toContain("@prefix");

    const parsed = parseLogEntryNTriples(writes[0]!.body, request.path);
    const parsedInternal = readAttachedInternalTriples(parsed.assertions);
    const parsedTimeNode = parsed.assertions.find(
      ([, predicate]) => predicate.value === "https://example.com/ns#time",
    )?.[2];

    expect(parsed).toMatchObject({
      entityName: request.entityName,
      entityId: request.entityId,
      changeId: request.changeId,
      parentChangeId: request.parentChangeId,
      timestamp: request.timestamp,
      path: request.path,
      rootUri: request.rootUri,
    });
    expect(parsed.assertions).toHaveLength(3);
    expect(parsed.retractions).toEqual([
      [
        uri("https://example.com/id/event/ev-123"),
        uri("https://example.com/ns#archived"),
        false,
      ],
    ]);
    expect(parsedTimeNode).toMatchObject({
      termType: "BlankNode",
    });
    expect(parsedInternal).toEqual(
      expect.arrayContaining([
        [
          uri("https://example.com/id/event/ev-123"),
          uri("https://example.com/ns#title"),
          literal("Hello", "en"),
        ],
        [
          uri("https://example.com/id/event/ev-123"),
          uri("https://example.com/ns#time"),
          expect.objectContaining({
            termType: "BlankNode",
          }),
        ],
        [
          expect.objectContaining({
            termType: "BlankNode",
            value: (parsedTimeNode as { value?: string } | undefined)?.value,
          }),
          uri("https://example.com/ns#year"),
          literal("2024", XSD_INTEGER),
        ],
      ]),
    );
  });
});
