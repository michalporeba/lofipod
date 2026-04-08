import { DataFactory, type BlankNode, type Literal, type NamedNode } from "n3";

const XSD_BOOLEAN = "http://www.w3.org/2001/XMLSchema#boolean";
const XSD_INTEGER = "http://www.w3.org/2001/XMLSchema#integer";
const XSD_DECIMAL = "http://www.w3.org/2001/XMLSchema#decimal";
const XSD_DOUBLE = "http://www.w3.org/2001/XMLSchema#double";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const INTERNAL_TRIPLES = "__lofipod_internal_rdf_triples";

export const { blankNode, literal, namedNode } = DataFactory;
export const uri = namedNode;

export type RdfSubject = NamedNode;
export type RdfTerm = NamedNode | BlankNode | Literal;
export type Term = RdfTerm | string | number | boolean;
export type RdfTriple = [
  subject: RdfSubject,
  predicate: NamedNode,
  object: RdfTerm,
];
export type Triple = [subject: NamedNode, predicate: NamedNode, object: Term];

type SerializedRdfTerm =
  | {
      termType: "NamedNode";
      value: string;
    }
  | {
      termType: "BlankNode";
      value: string;
    }
  | {
      termType: "Literal";
      value: string;
      datatype: string;
      language: string;
    };

type SerializedRdfTriple = [
  subject: SerializedRdfTerm,
  predicate: SerializedRdfTerm,
  object: SerializedRdfTerm,
];

type StoredTriplesValue =
  | Triple[]
  | {
      triples: Triple[];
      internal: SerializedRdfTriple[];
    };

type ToRdfTriplesOptions = {
  rdfType?: string | NamedNode;
};

function isRdfJsTerm(value: unknown): value is RdfTerm {
  return (
    typeof value === "object" &&
    value !== null &&
    "termType" in value &&
    "value" in value &&
    typeof (value as { termType?: unknown }).termType === "string" &&
    typeof (value as { value?: unknown }).value === "string"
  );
}

function isUriLike(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("urn:") ||
    value.startsWith("lofipod://")
  );
}

function resourceTerm(value: string): NamedNode {
  return namedNode(value);
}

function asRdfSubject(value: string | RdfTerm): RdfSubject {
  if (typeof value === "string") {
    return resourceTerm(value);
  }

  if (value.termType === "NamedNode") {
    return value;
  }

  throw new Error("RDF subjects must be named nodes.");
}

function asRdfPredicate(value: string | RdfTerm): NamedNode {
  if (typeof value === "string") {
    return namedNode(value);
  }

  if (value.termType === "NamedNode") {
    return value;
  }

  throw new Error("RDF predicates must be named nodes.");
}

function termToLiteral(value: number | boolean): Literal {
  if (typeof value === "boolean") {
    return literal(value ? "true" : "false", namedNode(XSD_BOOLEAN));
  }

  if (Number.isInteger(value)) {
    return literal(String(value), namedNode(XSD_INTEGER));
  }

  if (Number.isFinite(value)) {
    return literal(String(value), namedNode(XSD_DECIMAL));
  }

  return literal(String(value), namedNode(XSD_DOUBLE));
}

export function serializeRdfTerm(term: RdfTerm): SerializedRdfTerm {
  if (term.termType === "NamedNode") {
    return {
      termType: "NamedNode",
      value: term.value,
    };
  }

  if (term.termType === "BlankNode") {
    return {
      termType: "BlankNode",
      value: term.value,
    };
  }

  return {
    termType: "Literal",
    value: term.value,
    datatype: term.datatype.value,
    language: term.language,
  };
}

export function deserializeRdfTerm(term: SerializedRdfTerm): RdfTerm {
  if (term.termType === "NamedNode") {
    return namedNode(term.value);
  }

  if (term.termType === "BlankNode") {
    return blankNode(term.value);
  }

  if (term.language) {
    return literal(term.value, term.language);
  }

  return literal(term.value, namedNode(term.datatype));
}

function serializeRdfTriple([subject, predicate, object]: RdfTriple): SerializedRdfTriple {
  return [
    serializeRdfTerm(subject),
    serializeRdfTerm(predicate),
    serializeRdfTerm(object),
  ];
}

function deserializeRdfTriple([
  subject,
  predicate,
  object,
]: SerializedRdfTriple): RdfTriple {
  const deserializedSubject = deserializeRdfTerm(subject);
  const deserializedPredicate = deserializeRdfTerm(predicate);
  const deserializedObject = deserializeRdfTerm(object);

  if (
    deserializedSubject.termType !== "NamedNode" ||
    deserializedPredicate.termType !== "NamedNode"
  ) {
    throw new Error("Invalid serialized RDF triple.");
  }

  return [deserializedSubject, deserializedPredicate, deserializedObject];
}

export function attachInternalTriples(
  triples: Triple[],
  internalTriples: RdfTriple[],
): Triple[] {
  Object.defineProperty(triples, INTERNAL_TRIPLES, {
    value: internalTriples.map(serializeRdfTriple),
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return triples;
}

export function readAttachedInternalTriples(triples: Triple[]): RdfTriple[] | null {
  const serialized = (triples as Triple[] & {
    [INTERNAL_TRIPLES]?: SerializedRdfTriple[];
  })[INTERNAL_TRIPLES];

  return serialized ? serialized.map(deserializeRdfTriple) : null;
}

export function clonePublicTriples(triples: Triple[]): Triple[] {
  const cloned = triples.map(([subject, predicate, object]) => [
    subject,
    predicate,
    object,
  ]) as Triple[];
  const internal = readAttachedInternalTriples(triples);

  if (internal) {
    attachInternalTriples(cloned, internal);
  }

  return cloned;
}

export function encodeStoredTriples(triples: Triple[]): StoredTriplesValue {
  const internal = readAttachedInternalTriples(triples);

  if (!internal) {
    return clonePublicTriples(triples);
  }

  return {
    triples: clonePublicTriples(triples),
    internal: internal.map(serializeRdfTriple),
  };
}

export function decodeStoredTriples(value: StoredTriplesValue): Triple[] {
  if (Array.isArray(value)) {
    return clonePublicTriples(value);
  }

  return rdfTriplesToPublicTriples(value.internal.map(deserializeRdfTriple));
}

export function rdfTermToPublicTerm(term: RdfTerm): Term {
  if (term.termType === "NamedNode") {
    return term;
  }

  if (term.termType === "BlankNode") {
    return term;
  }

  if (term.datatype.value === XSD_BOOLEAN) {
    return term.value === "true";
  }

  if (
    term.datatype.value === XSD_INTEGER ||
    term.datatype.value === XSD_DECIMAL ||
    term.datatype.value === XSD_DOUBLE
  ) {
    return Number(term.value);
  }

  return term.value;
}

export function rdfTriplesToPublicTriples(triples: RdfTriple[]): Triple[] {
  return attachInternalTriples(
    triples.map(([subject, predicate, object]) => [
      subject,
      predicate,
      rdfTermToPublicTerm(object),
    ]),
    triples,
  );
}

export function publicTriplesToRdfTriples(
  triples: Triple[],
  options: ToRdfTriplesOptions = {},
): RdfTriple[] {
  const attached = readAttachedInternalTriples(triples);

  if (attached) {
    return attached;
  }

  const knownResourceTerms = new Set<string>();

  for (const [subject, predicate] of triples) {
    if (typeof subject === "string" && isUriLike(subject)) {
      knownResourceTerms.add(subject);
    }

    if (typeof predicate === "string" && isUriLike(predicate)) {
      knownResourceTerms.add(predicate);
    }
  }

  if (options.rdfType) {
    knownResourceTerms.add(
      typeof options.rdfType === "string" ? options.rdfType : options.rdfType.value,
    );
  }

  return triples.map(([subject, predicate, object]) => {
    const rdfSubject = asRdfSubject(
      isRdfJsTerm(subject) ? subject : String(subject),
    );
    const rdfPredicate = asRdfPredicate(
      isRdfJsTerm(predicate) ? predicate : String(predicate),
    );
    let rdfObject: RdfTerm;

    if (isRdfJsTerm(object)) {
      rdfObject = object;
    } else if (typeof object === "number" || typeof object === "boolean") {
      rdfObject = termToLiteral(object);
    } else if (
      rdfPredicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" ||
      knownResourceTerms.has(object) ||
      object.startsWith("_:")
    ) {
      rdfObject = resourceTerm(object);
    } else if (isUriLike(object)) {
      rdfObject = namedNode(object);
    } else {
      rdfObject = literal(object);
    }
    return [rdfSubject, rdfPredicate, rdfObject];
  });
}

export function rdfTripleKey([subject, predicate, object]: RdfTriple): string {
  return `${subject.termType}:${subject.id}|${predicate.termType}:${predicate.id}|${object.termType}:${object.id}`;
}

export function rdfTermToN3(term: RdfTerm): string {
  if (term.termType === "NamedNode") {
    return `<${term.value}>`;
  }

  if (term.termType === "BlankNode") {
    return `_:${term.value}`;
  }

  const escaped = JSON.stringify(term.value);

  if (term.language) {
    return `${escaped}@${term.language}`;
  }

  if (
    term.datatype.value === XSD_BOOLEAN ||
    term.datatype.value === XSD_INTEGER ||
    term.datatype.value === XSD_DECIMAL ||
    term.datatype.value === XSD_DOUBLE
  ) {
    return term.value;
  }

  if (term.datatype.value === XSD_STRING) {
    return escaped;
  }

  return `${escaped}^^<${term.datatype.value}>`;
}

export function isNamedNodeTerm(value: unknown): value is NamedNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "termType" in value &&
    "value" in value &&
    (value as { termType?: unknown }).termType === "NamedNode" &&
    typeof (value as { value?: unknown }).value === "string"
  );
}

export function objectOf(
  graph: Triple[],
  subject: NamedNode,
  predicate: NamedNode,
): Triple[2] | undefined {
  const sameNode = (left: unknown, right: NamedNode): boolean => {
    if (isNamedNodeTerm(left)) {
      return left.value === right.value;
    }

    return typeof left === "string" && left === right.value;
  };

  return graph.find(
    ([subjectTerm, predicateTerm]) =>
      sameNode(subjectTerm, subject) && sameNode(predicateTerm, predicate),
  )?.[2];
}

export function stringValue(
  graph: Triple[],
  subject: NamedNode,
  predicate: NamedNode,
): string {
  const value = objectOf(graph, subject, predicate);

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (!value) {
    return "";
  }

  return typeof value === "string" ? value : value.value;
}

export function numberValue(
  graph: Triple[],
  subject: NamedNode,
  predicate: NamedNode,
): number {
  const value = objectOf(graph, subject, predicate);

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return Number(value);
  }

  if (!value) {
    return 0;
  }

  return Number(typeof value === "string" ? value : value.value);
}

export function booleanValue(
  graph: Triple[],
  subject: NamedNode,
  predicate: NamedNode,
): boolean {
  const value = objectOf(graph, subject, predicate);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (!value) {
    return false;
  }

  return (typeof value === "string" ? value : value.value) === "true";
}
