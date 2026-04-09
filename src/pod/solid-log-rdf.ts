import type { PodLogAppendRequest } from "../types.js";
import {
  blankNode,
  literal,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
  type RdfTriple,
  uri,
} from "../rdf.js";
import {
  type ObjectNode,
  parseRdf,
  readObject,
  serializeWithWriter,
  type SubjectNode,
  isSubjectNode,
} from "./solid-rdf-common.js";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LOG_CHANGE = "urn:lofipod:log:Change";
const LOG_CHANGE_ID = "urn:lofipod:log:changeId";
const LOG_PARENT_CHANGE_ID = "urn:lofipod:log:parentChangeId";
const LOG_TIMESTAMP = "urn:lofipod:log:timestamp";
const LOG_ENTITY_NAME = "urn:lofipod:log:entityName";
const LOG_ENTITY_ID = "urn:lofipod:log:entityId";
const LOG_ROOT_URI = "urn:lofipod:log:rootUri";
const LOG_ASSERTS = "urn:lofipod:log:asserts";
const LOG_RETRACTS = "urn:lofipod:log:retracts";
const LOG_SUBJECT = "urn:lofipod:log:subject";
const LOG_PREDICATE = "urn:lofipod:log:predicate";
const LOG_OBJECT = "urn:lofipod:log:object";

function n3ObjectLiteral(value: string) {
  return literal(value);
}

function parseLogStatements(
  quads: ReturnType<typeof parseRdf>,
  changeNode: SubjectNode,
  predicate: string,
) {
  const triples = quads
    .filter(
      (quad) =>
        quad.subject.equals(changeNode) &&
        quad.predicate.termType === "NamedNode" &&
        quad.predicate.value === predicate,
    )
    .flatMap((quad) =>
      quad.object.termType === "BlankNode" ? [quad.object] : [],
    )
    .map((statementNode) => {
      const subject = readObject(quads, statementNode, LOG_SUBJECT);
      const statementPredicate = readObject(
        quads,
        statementNode,
        LOG_PREDICATE,
      );
      const object = readObject(quads, statementNode, LOG_OBJECT);

      if (
        !subject ||
        (subject.termType !== "NamedNode" &&
          subject.termType !== "BlankNode") ||
        !statementPredicate ||
        statementPredicate.termType !== "NamedNode" ||
        !object ||
        (object.termType !== "NamedNode" &&
          object.termType !== "BlankNode" &&
          object.termType !== "Literal")
      ) {
        throw new Error("Invalid replication log statement.");
      }

      return [subject, statementPredicate, object] as RdfTriple;
    });

  return rdfTriplesToPublicTriples(triples);
}

export function serializeLogEntry(
  request: PodLogAppendRequest,
): Promise<string> {
  return serializeWithWriter("N-Triples", (writer) => {
    const changeNode = blankNode("change");
    const add = (
      subject: SubjectNode,
      predicate: string,
      object: ObjectNode,
    ) => {
      writer.addQuad(subject, uri(predicate), object);
    };

    add(changeNode, RDF_TYPE, uri(LOG_CHANGE));
    add(changeNode, LOG_CHANGE_ID, n3ObjectLiteral(request.changeId));
    add(changeNode, LOG_ENTITY_NAME, n3ObjectLiteral(request.entityName));
    add(changeNode, LOG_ENTITY_ID, n3ObjectLiteral(request.entityId));
    add(changeNode, LOG_TIMESTAMP, n3ObjectLiteral(request.timestamp));
    add(changeNode, LOG_ROOT_URI, uri(request.rootUri));

    if (request.parentChangeId) {
      add(
        changeNode,
        LOG_PARENT_CHANGE_ID,
        n3ObjectLiteral(request.parentChangeId),
      );
    }

    for (const [index, triple] of request.assertions.entries()) {
      const statementNode = blankNode(`assert-${index}`);
      const [subject, predicate, object] = publicTriplesToRdfTriples([
        triple,
      ])[0]!;

      add(changeNode, LOG_ASSERTS, statementNode);
      writer.addQuad(statementNode, uri(LOG_SUBJECT), subject);
      writer.addQuad(statementNode, uri(LOG_PREDICATE), predicate);
      writer.addQuad(statementNode, uri(LOG_OBJECT), object);
    }

    for (const [index, triple] of request.retractions.entries()) {
      const statementNode = blankNode(`retract-${index}`);
      const [subject, predicate, object] = publicTriplesToRdfTriples([
        triple,
      ])[0]!;

      add(changeNode, LOG_RETRACTS, statementNode);
      writer.addQuad(statementNode, uri(LOG_SUBJECT), subject);
      writer.addQuad(statementNode, uri(LOG_PREDICATE), predicate);
      writer.addQuad(statementNode, uri(LOG_OBJECT), object);
    }
  });
}

export function parseLogEntryNTriples(
  body: string,
  path: string,
): PodLogAppendRequest {
  const quads = parseRdf(body, { format: "N-Triples" });
  const changeQuad = quads.find(
    (quad) =>
      isSubjectNode(quad.subject) &&
      quad.predicate.termType === "NamedNode" &&
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === "NamedNode" &&
      quad.object.value === LOG_CHANGE,
  );
  const changeNode =
    changeQuad && isSubjectNode(changeQuad.subject) ? changeQuad.subject : null;

  if (!changeNode) {
    throw new Error("Replication log entry is missing a change node.");
  }

  const changeId = readObject(quads, changeNode, LOG_CHANGE_ID);
  const parentChangeId = readObject(quads, changeNode, LOG_PARENT_CHANGE_ID);
  const timestamp = readObject(quads, changeNode, LOG_TIMESTAMP);
  const entityName = readObject(quads, changeNode, LOG_ENTITY_NAME);
  const entityId = readObject(quads, changeNode, LOG_ENTITY_ID);
  const rootUri = readObject(quads, changeNode, LOG_ROOT_URI);

  if (
    changeId?.termType !== "Literal" ||
    (parentChangeId && parentChangeId.termType !== "Literal") ||
    timestamp?.termType !== "Literal" ||
    entityName?.termType !== "Literal" ||
    entityId?.termType !== "Literal" ||
    rootUri?.termType !== "NamedNode"
  ) {
    throw new Error("Replication log entry is missing required metadata.");
  }

  return {
    entityName: entityName.value,
    entityId: entityId.value,
    changeId: changeId.value,
    parentChangeId:
      parentChangeId?.termType === "Literal" ? parentChangeId.value : null,
    timestamp: timestamp.value,
    path,
    rootUri: rootUri.value,
    assertions: parseLogStatements(quads, changeNode, LOG_ASSERTS),
    retractions: parseLogStatements(quads, changeNode, LOG_RETRACTS),
  };
}
