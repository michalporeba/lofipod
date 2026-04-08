import { describe, expect, it } from "vitest";

import { diffTriples } from "../src/graph.js";
import {
  decodeStoredTriples,
  encodeStoredTriples,
  literal,
  namedNode,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
  type RdfTriple,
} from "../src/rdf.js";

describe("internal RDF terms", () => {
  it("preserves the distinction between named nodes and literals during storage serialization", () => {
    const subject = namedNode("https://example.com/id/bookmark/1");
    const predicate = namedNode("https://example.com/ns#url");
    const literalTriple: RdfTriple[] = [
      [subject, predicate, literal("https://example.com/value")],
    ];
    const namedNodeTriple: RdfTriple[] = [
      [subject, predicate, namedNode("https://example.com/value")],
    ];

    const literalRoundTrip = publicTriplesToRdfTriples(
      decodeStoredTriples(encodeStoredTriples(rdfTriplesToPublicTriples(literalTriple))),
    );
    const namedNodeRoundTrip = publicTriplesToRdfTriples(
      decodeStoredTriples(encodeStoredTriples(rdfTriplesToPublicTriples(namedNodeTriple))),
    );

    expect(literalRoundTrip[0]?.[2].termType).toBe("Literal");
    expect(namedNodeRoundTrip[0]?.[2].termType).toBe("NamedNode");
  });

  it("diffs triples using RDF term identity rather than plain string equality", () => {
    const subject = namedNode("https://example.com/id/bookmark/1");
    const predicate = namedNode("https://example.com/ns#url");
    const previous: RdfTriple[] = [
      [subject, predicate, literal("https://example.com/value")],
    ];
    const next: RdfTriple[] = [
      [subject, predicate, namedNode("https://example.com/value")],
    ];

    const diff = diffTriples(previous, next);

    expect(diff.assertions).toHaveLength(1);
    expect(diff.retractions).toHaveLength(1);
    expect(diff.assertions[0]?.[2].termType).toBe("NamedNode");
    expect(diff.retractions[0]?.[2].termType).toBe("Literal");
  });
});
