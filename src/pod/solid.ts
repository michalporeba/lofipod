import type {
  PodEntityPatchRequest,
  PodLogAppendRequest,
  PodSyncAdapter,
} from "../types.js";

type SolidPodAdapterOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
};

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

function termToTurtle(term: string | number | boolean): string {
  if (typeof term === "number" || typeof term === "boolean") {
    return String(term);
  }

  if (
    term.startsWith("http://") ||
    term.startsWith("https://") ||
    term.startsWith("urn:") ||
    term.startsWith("lofipod://")
  ) {
    return `<${term}>`;
  }

  return JSON.stringify(term);
}

function serializeTriples(
  triples: PodEntityPatchRequest["assertions"],
): string {
  return triples
    .map(
      ([subject, predicate, object]) =>
        `${termToTurtle(subject)} ${termToTurtle(predicate)} ${termToTurtle(object)} .`,
    )
    .join("\n");
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
            body: serializeTriples(request.assertions),
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
  };
}
