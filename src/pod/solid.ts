import { Parser, Writer, type BlankNode, type Literal, type NamedNode, type Quad } from "n3";
import type {
  PodEntityPatchRequest,
  PodLogAppendRequest,
  PodSyncAdapter,
} from "../types.js";
import {
  blankNode,
  isNamedNodeTerm,
  literal,
  publicTriplesToRdfTriples,
  rdfTriplesToPublicTriples,
  type RdfTriple,
  uri,
} from "../rdf.js";

type SolidPodAdapterOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
};

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";
const LOG_CHANGE = "urn:lofipod:log:Change";
const LOG_CHANGE_ID = "urn:lofipod:log:changeId";
const LOG_PARENT_CHANGE_ID = "urn:lofipod:log:parentChangeId";
const LOG_ENTITY_NAME = "urn:lofipod:log:entityName";
const LOG_ENTITY_ID = "urn:lofipod:log:entityId";
const LOG_ROOT_URI = "urn:lofipod:log:rootUri";
const LOG_ASSERTS = "urn:lofipod:log:asserts";
const LOG_RETRACTS = "urn:lofipod:log:retracts";
const LOG_SUBJECT = "urn:lofipod:log:subject";
const LOG_PREDICATE = "urn:lofipod:log:predicate";
const LOG_OBJECT = "urn:lofipod:log:object";
type SubjectNode = NamedNode | BlankNode;
type ObjectNode = NamedNode | BlankNode | Literal;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, normalizeBaseUrl(baseUrl)).toString();
}

function parentContainerPaths(path: string): string[] {
  const cleaned = path.replace(/^\/+/, "");
  const segments = cleaned.split("/").filter(Boolean);

  return segments
    .slice(0, -1)
    .map((_, index) => `${segments.slice(0, index + 1).join("/")}/`);
}

function findRdfType(
  triples: PodEntityPatchRequest["assertions"],
): string | undefined {
  const rdfType = triples.find(
    ([, predicate, object]) =>
      predicate.value === RDF_TYPE && isNamedNodeTerm(object),
  )?.[2];

  return isNamedNodeTerm(rdfType) ? rdfType.value : undefined;
}

function isSubjectNode(term: Quad["subject"] | Quad["object"]): term is SubjectNode {
  return term.termType === "NamedNode" || term.termType === "BlankNode";
}

function isObjectNode(term: Quad["object"]): term is ObjectNode {
  return (
    term.termType === "NamedNode" ||
    term.termType === "BlankNode" ||
    term.termType === "Literal"
  );
}

function quadToRdfTriple(quad: Quad): RdfTriple | null {
  if (
    !isSubjectNode(quad.subject) ||
    quad.predicate.termType !== "NamedNode" ||
    !isObjectNode(quad.object)
  ) {
    return null;
  }

  return [quad.subject, quad.predicate, quad.object];
}

function parseRdf(
  body: string,
  options: { format?: "text/turtle" | "N-Triples"; baseIRI?: string } = {},
) {
  return new Parser(options).parse(body);
}

function serializeRdfTriples(
  triples: PodEntityPatchRequest["assertions"],
  options: {
    format?: "Turtle" | "N-Triples";
    rdfType?: string;
  } = {},
) {
  const writer = new Writer({ format: options.format ?? "Turtle" });

  for (const [subject, predicate, object] of publicTriplesToRdfTriples(triples, {
    rdfType: options.rdfType,
  })) {
    writer.addQuad(subject, predicate, object);
  }

  return new Promise<string>((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
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

  return rdfTriplesToPublicTriples(
    triples,
  );
}

function parseContainedResourcePaths(
  containerBody: string,
  containerUrl: string,
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

    if (!resourceUrl.pathname.endsWith("/")) {
      paths.add(resourceUrl.pathname.replace(/^\/+/, ""));
    }
  }

  return Array.from(paths);
}

function n3ObjectLiteral(value: string) {
  return literal(value);
}

async function serializeLogEntry(request: PodLogAppendRequest): Promise<string> {
  const changeNode = blankNode("change");
  const writer = new Writer({ format: "N-Triples" });
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
  add(changeNode, LOG_ROOT_URI, uri(request.rootUri));

  if (request.parentChangeId) {
    add(changeNode, LOG_PARENT_CHANGE_ID, n3ObjectLiteral(request.parentChangeId));
  }

  for (const [index, triple] of request.assertions.entries()) {
    const statementNode = blankNode(`assert-${index}`);
    const [subject, predicate, object] = publicTriplesToRdfTriples([triple])[0]!;

    add(changeNode, LOG_ASSERTS, statementNode);
    writer.addQuad(statementNode, uri(LOG_SUBJECT), subject);
    writer.addQuad(statementNode, uri(LOG_PREDICATE), predicate);
    writer.addQuad(statementNode, uri(LOG_OBJECT), object);
  }

  for (const [index, triple] of request.retractions.entries()) {
    const statementNode = blankNode(`retract-${index}`);
    const [subject, predicate, object] = publicTriplesToRdfTriples([triple])[0]!;

    add(changeNode, LOG_RETRACTS, statementNode);
    writer.addQuad(statementNode, uri(LOG_SUBJECT), subject);
    writer.addQuad(statementNode, uri(LOG_PREDICATE), predicate);
    writer.addQuad(statementNode, uri(LOG_OBJECT), object);
  }

  return new Promise<string>((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function readObject(
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

function parseLogStatements(
  quads: Quad[],
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
    .flatMap((quad) => (quad.object.termType === "BlankNode" ? [quad.object] : []))
    .map((statementNode) => {
      const subject = readObject(quads, statementNode, LOG_SUBJECT);
      const statementPredicate = readObject(quads, statementNode, LOG_PREDICATE);
      const object = readObject(quads, statementNode, LOG_OBJECT);

      if (
        !subject ||
        (subject.termType !== "NamedNode" && subject.termType !== "BlankNode") ||
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
  const entityName = readObject(quads, changeNode, LOG_ENTITY_NAME);
  const entityId = readObject(quads, changeNode, LOG_ENTITY_ID);
  const rootUri = readObject(quads, changeNode, LOG_ROOT_URI);

  if (
    changeId?.termType !== "Literal" ||
    (parentChangeId &&
      parentChangeId.termType !== "Literal") ||
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
    parentChangeId: parentChangeId?.termType === "Literal" ? parentChangeId.value : null,
    path,
    rootUri: rootUri.value,
    assertions: parseLogStatements(quads, changeNode, LOG_ASSERTS),
    retractions: parseLogStatements(quads, changeNode, LOG_RETRACTS),
  };
}

function textResponse(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

async function ensureSuccess(
  response: Response,
  context: string,
): Promise<void> {
  if (response.ok) {
    return;
  }

  const detail = await textResponse(response);
  throw new Error(
    `${context} failed with ${response.status}${detail ? `: ${detail}` : ""}`,
  );
}

export function createSolidPodAdapter(
  options: SolidPodAdapterOptions,
): PodSyncAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const podBaseUrl = normalizeBaseUrl(options.podBaseUrl);
  const authHeaders: Record<string, string> = {};

  if (options.authorization) {
    authHeaders.Authorization = options.authorization;
  }

  const ensureContainers = async (path: string): Promise<void> => {
    for (const containerPath of parentContainerPaths(path)) {
      const parentPath = containerPath
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .join("/");
      const parentUrl = joinUrl(podBaseUrl, parentPath ? `${parentPath}/` : "");
      const slug = containerPath.split("/").filter(Boolean).at(-1);

      if (!slug) {
        continue;
      }

      const response = await fetchImpl(parentUrl, {
        method: "POST",
        headers: {
          ...authHeaders,
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          Slug: slug,
        },
      });

      if (response.ok || response.status === 409) {
        continue;
      }

      await ensureSuccess(response, `Create container ${containerPath}`);
    }
  };

  const ensureResource = async (path: string): Promise<boolean> => {
    const url = joinUrl(podBaseUrl, path);
    const head = await fetchImpl(url, {
      method: "HEAD",
      headers: authHeaders,
    });

    if (head.ok) {
      return false;
    }

    if (head.status !== 404) {
      await ensureSuccess(head, `Check resource ${path}`);
    }

    return true;
  };

  return {
    async applyEntityPatch(request: PodEntityPatchRequest) {
      await ensureContainers(request.path);
      const shouldCreate = await ensureResource(request.path);

      if (shouldCreate) {
        if (request.retractions.length > 0) {
          throw new Error(
            `Cannot create ${request.path} from a delta that retracts triples.`,
          );
        }

        const body = await serializeRdfTriples(request.assertions, {
          rdfType: findRdfType(request.assertions),
        });

        const createResponse = await fetchImpl(
          joinUrl(podBaseUrl, request.path),
          {
            method: "PUT",
            headers: {
              ...authHeaders,
              "Content-Type": "text/turtle",
              "If-None-Match": "*",
            },
            body,
          },
        );

        await ensureSuccess(
          createResponse,
          `Create canonical entity resource for ${request.entityName}/${request.entityId}`,
        );
        return;
      }

      const response = await fetchImpl(joinUrl(podBaseUrl, request.path), {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "text/n3",
        },
        body: request.patch,
      });

      await ensureSuccess(
        response,
        `Apply entity patch for ${request.entityName}/${request.entityId}`,
      );
    },

    async appendLogEntry(request: PodLogAppendRequest) {
      await ensureContainers(request.path);
      const body = await serializeLogEntry(request);

      const response = await fetchImpl(joinUrl(podBaseUrl, request.path), {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/n-triples",
        },
        body,
      });

      await ensureSuccess(
        response,
        `Append remote log entry for ${request.entityName}/${request.changeId}`,
      );
    },

    async listCanonicalEntities(input) {
      const containerUrl = joinUrl(podBaseUrl, input.basePath);
      const containerResponse = await fetchImpl(containerUrl, {
        headers: {
          ...authHeaders,
          Accept: "text/turtle",
        },
      });

      if (containerResponse.status === 404) {
        return [];
      }

      await ensureSuccess(
        containerResponse,
        `List canonical entities for ${input.entityName}`,
      );

      const containerBody = await containerResponse.text();
      const resourcePaths = parseContainedResourcePaths(
        containerBody,
        containerUrl,
      )
        .filter((path) => path.startsWith(input.basePath))
        .filter((path) => path.endsWith(".ttl"));
      const results: {
        entityId: string;
        path: string;
        rootUri: string;
        graph: PodEntityPatchRequest["assertions"];
      }[] = [];

      for (const path of resourcePaths) {
        const response = await fetchImpl(joinUrl(podBaseUrl, path), {
          headers: {
            ...authHeaders,
            Accept: "text/turtle",
          },
        });

        await ensureSuccess(response, `Read canonical entity ${path}`);
        const body = await response.text();
        const graph = parseCanonicalTriples(body, {
          baseIRI: joinUrl(podBaseUrl, path),
        });
        const rootUri = graph.find(
          ([_, predicate, object]) =>
            predicate.value === RDF_TYPE &&
            isNamedNodeTerm(object) &&
            object.value === input.rdfType.value,
        )?.[0];

        if (!isNamedNodeTerm(rootUri)) {
          continue;
        }

        results.push({
          entityId:
            path
              .split("/")
              .at(-1)
              ?.replace(/\.ttl$/, "") ?? "",
          path,
          rootUri: rootUri.value,
          graph,
        });
      }

      return results;
    },
  };
}
