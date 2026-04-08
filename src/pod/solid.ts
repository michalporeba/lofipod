import type {
  PodEntityPatchRequest,
  PodLogAppendRequest,
  PodSyncAdapter,
} from "../types.js";
import {
  isNamedNodeTerm,
  literal,
  publicTriplesToRdfTriples,
  rdfTermToN3,
  uri,
} from "../rdf.js";

type SolidPodAdapterOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
};

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

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

function serializeTriples(
  triples: PodEntityPatchRequest["assertions"],
  options: { rdfType?: string } = {},
): string {
  return publicTriplesToRdfTriples(triples, options)
    .map(
      ([subject, predicate, object]) =>
        `${rdfTermToN3(subject)} ${rdfTermToN3(predicate)} ${rdfTermToN3(object)} .`,
    )
    .join("\n");
}

function parseQuotedLiteral(value: string): string {
  return JSON.parse(value);
}

function parseTerm(term: string) {
  const trimmed = term.trim();

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return uri(trimmed.slice(1, -1));
  }

  if (trimmed.startsWith('"')) {
    return literal(parseQuotedLiteral(trimmed));
  }

  if (trimmed === "true" || trimmed === "false") {
    return trimmed === "true";
  }

  const numeric = Number(trimmed);

  if (!Number.isNaN(numeric) && trimmed !== "") {
    return numeric;
  }

  throw new Error(`Unsupported Turtle term: ${term}`);
}

function parseSimpleTurtleTriples(body: string) {
  const triples: PodEntityPatchRequest["assertions"] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();

    if (
      trimmed.length === 0 ||
      trimmed.startsWith("@prefix") ||
      trimmed.startsWith("#")
    ) {
      continue;
    }

    const match = trimmed.match(
      /^(<[^>]+>|"[^"\\]*(?:\\.[^"\\]*)*"|true|false|-?\d+(?:\.\d+)?)\s+(<[^>]+>)\s+(<[^>]+>|"[^"\\]*(?:\\.[^"\\]*)*"|true|false|-?\d+(?:\.\d+)?)\s*\.\s*$/,
    );

    if (!match) {
      continue;
    }

    const subject = parseTerm(match[1]!);
    const predicate = parseTerm(match[2]!);
    const object = parseTerm(match[3]!);

    if (!isNamedNodeTerm(subject) || !isNamedNodeTerm(predicate)) {
      continue;
    }

    triples.push([subject, predicate, object]);
  }

  return triples;
}

function parseContainedResourcePaths(
  containerBody: string,
  containerUrl: string,
) {
  const paths = new Set<string>();
  const lines = containerBody.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;

    if (
      !line.includes("ldp:contains") &&
      !line.includes("<http://www.w3.org/ns/ldp#contains>")
    ) {
      continue;
    }

    let statement = line
      .replace(/^.*?<http:\/\/www\.w3\.org\/ns\/ldp#contains>\s*/, "")
      .replace(/^.*?ldp:contains\s*/, "")
      .trim();

    while (!statement.trim().endsWith(".") && index + 1 < lines.length) {
      index += 1;
      statement = `${statement} ${lines[index]!.trim()}`;
    }

    for (const iriMatch of statement.matchAll(/<([^>]+)>/g)) {
      const resourceUrl = new URL(iriMatch[1]!, containerUrl);
      if (!resourceUrl.pathname.endsWith("/")) {
        paths.add(resourceUrl.pathname.replace(/^\/+/, ""));
      }
    }
  }

  return Array.from(paths);
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

        const createResponse = await fetchImpl(
          joinUrl(podBaseUrl, request.path),
          {
            method: "PUT",
            headers: {
              ...authHeaders,
              "Content-Type": "text/turtle",
              "If-None-Match": "*",
            },
            body: serializeTriples(request.assertions, {
              rdfType: request.assertions.find(
                ([, predicate]) => predicate.value === RDF_TYPE,
              )?.[2] && isNamedNodeTerm(
                request.assertions.find(([, predicate]) => predicate.value === RDF_TYPE)?.[2],
              )
                ? (
                    request.assertions.find(([, predicate]) => predicate.value === RDF_TYPE)?.[2] as {
                      value: string;
                    }
                  ).value
                : undefined,
            }),
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

      const body = [
        `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.`,
        `@prefix solid: <http://www.w3.org/ns/solid/terms#>.`,
        "",
        `<${request.rootUri}> rdf:type <urn:lofipod:log:Change>.`,
        `<${request.rootUri}> <urn:lofipod:log:changeId> "${request.changeId}".`,
        ...request.assertions.map(
          ([subject, predicate, object]) =>
            `<${request.rootUri}> <urn:lofipod:log:asserts> "${JSON.stringify([subject, predicate, object])}".`,
        ),
        ...request.retractions.map(
          ([subject, predicate, object]) =>
            `<${request.rootUri}> <urn:lofipod:log:retracts> "${JSON.stringify([subject, predicate, object])}".`,
        ),
        "",
      ].join("\n");

      const response = await fetchImpl(joinUrl(podBaseUrl, request.path), {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "text/turtle",
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
        const graph = parseSimpleTurtleTriples(body);
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
