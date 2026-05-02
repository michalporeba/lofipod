import type { PodEntityPatchRequest } from "../types.js";
import {
  isNamedNodeTerm,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
} from "../rdf.js";
import {
  parseRdf,
  quadToRdfTriple,
  serializeWithWriter,
} from "./solid-rdf-common.js";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

export function findRdfType(
  triples: PodEntityPatchRequest["assertions"],
): string | undefined {
  const rdfType = triples.find(
    ([, predicate, object]) =>
      predicate.value === RDF_TYPE && isNamedNodeTerm(object),
  )?.[2];

  return isNamedNodeTerm(rdfType) ? rdfType.value : undefined;
}

export function serializeCanonicalTriples(
  triples: PodEntityPatchRequest["assertions"],
  rdfType?: string,
): Promise<string> {
  return serializeWithWriter("Turtle", (writer) => {
    for (const [subject, predicate, object] of publicTriplesToRdfTriples(
      triples,
      { rdfType },
    )) {
      writer.addQuad(subject, predicate, object);
    }
  });
}

export function parseCanonicalTriples(
  body: string,
  options: { baseIRI?: string } = {},
) {
  const triples = parseRdf(body, {
    format: "text/turtle",
    baseIRI: options.baseIRI,
  }).flatMap((quad) => {
    const triple = quadToRdfTriple(quad);

    return triple ? [triple] : [];
  });

  return rdfTriplesToPublicTriples(triples);
}

export function parseContainedResourcePaths(
  containerBody: string,
  containerUrl: string,
  options: { includeContainers?: boolean } = {},
) {
  const paths = new Set<string>();
  const quads = parseRdf(containerBody, {
    format: "text/turtle",
    baseIRI: containerUrl,
  });

  for (const quad of quads) {
    if (
      quad.predicate.termType !== "NamedNode" ||
      quad.predicate.value !== LDP_CONTAINS ||
      quad.object.termType !== "NamedNode"
    ) {
      continue;
    }

    const resourceUrl = new URL(quad.object.value, containerUrl);

    const path = resourceUrl.pathname.replace(/^\/+/, "");

    if (resourceUrl.pathname.endsWith("/")) {
      if (options.includeContainers) {
        paths.add(path);
      }

      continue;
    }

    paths.add(path);
  }

  return Array.from(paths);
}
