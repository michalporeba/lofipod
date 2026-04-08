import {
  Parser,
  Writer,
  type BlankNode,
  type Literal,
  type NamedNode,
  type Quad,
} from "n3";
import type { RdfTriple } from "../rdf.js";

export type SubjectNode = NamedNode | BlankNode;
export type ObjectNode = NamedNode | BlankNode | Literal;

export function parseRdf(
  body: string,
  options: { format?: "text/turtle" | "N-Triples"; baseIRI?: string } = {},
) {
  return new Parser(options).parse(body);
}

export function serializeWithWriter(
  format: "Turtle" | "N-Triples",
  write: (writer: Writer) => void,
): Promise<string> {
  const writer = new Writer({ format });
  write(writer);

  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

export function isSubjectNode(
  term: Quad["subject"] | Quad["object"],
): term is SubjectNode {
  return term.termType === "NamedNode" || term.termType === "BlankNode";
}

export function isObjectNode(term: Quad["object"]): term is ObjectNode {
  return (
    term.termType === "NamedNode" ||
    term.termType === "BlankNode" ||
    term.termType === "Literal"
  );
}

export function quadToRdfTriple(quad: Quad): RdfTriple | null {
  if (
    !isSubjectNode(quad.subject) ||
    quad.predicate.termType !== "NamedNode" ||
    !isObjectNode(quad.object)
  ) {
    return null;
  }

  return [quad.subject, quad.predicate, quad.object];
}

export function readObject(
  quads: Quad[],
  subject: SubjectNode,
  predicate: string,
) {
  return quads.find(
    (quad) =>
      quad.subject.equals(subject) &&
      quad.predicate.termType === "NamedNode" &&
      quad.predicate.value === predicate,
  )?.object;
}
