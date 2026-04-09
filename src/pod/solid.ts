import type { NamedNode } from "n3";
import type {
  PodEntityPatchRequest,
  PodLogAppendRequest,
  PodSyncAdapter,
} from "../types.js";
import { isNamedNodeTerm } from "../rdf.js";
import { createSolidHttpClient } from "./solid-http.js";
import { subscribeToSolidContainer } from "./solid-notifications.js";
import {
  findRdfType,
  parseCanonicalTriples,
  parseContainedResourcePaths,
  serializeCanonicalTriples,
  serializeLogEntry,
} from "./solid-rdf.js";

type SolidPodAdapterOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
};

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MISSING_CONTAINER_VERSION = "urn:lofipod:container:missing";
const NO_VALIDATOR_CONTAINER_VERSION = "urn:lofipod:container:no-validator";

export { parseCanonicalTriples, parseLogEntryNTriples } from "./solid-rdf.js";

export function createSolidPodAdapter(
  options: SolidPodAdapterOptions,
): PodSyncAdapter {
  const http = createSolidHttpClient(options);
  const fetchImpl = options.fetch ?? fetch;

  const readContainerVersion = async (
    basePath: string,
    entityName: string,
  ): Promise<{
    exists: boolean;
    version: string | null;
  }> => {
    const response = await fetchImpl(http.joinUrl(basePath), {
      method: "HEAD",
      headers: http.authHeaders,
    });

    if (response.status === 404) {
      return {
        exists: false,
        version: null,
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Check canonical container for ${entityName} failed with ${response.status}${body ? `: ${body}` : ""}`,
      );
    }

    return {
      exists: true,
      version:
        response.headers.get("etag") ?? response.headers.get("last-modified"),
    };
  };

  const listCanonicalEntities = async (input: {
    entityName: string;
    basePath: string;
    rdfType: NamedNode;
  }) => {
    const containerPath = input.basePath;
    const containerUrl = http.joinUrl(containerPath);
    const containerResponse = await fetchImpl(containerUrl, {
      headers: {
        ...http.authHeaders,
        Accept: "text/turtle",
      },
    });

    if (containerResponse.status === 404) {
      return [];
    }

    if (!containerResponse.ok) {
      const body = await containerResponse.text().catch(() => "");
      throw new Error(
        `List canonical entities for ${input.entityName} failed with ${containerResponse.status}${body ? `: ${body}` : ""}`,
      );
    }

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
      const body = await http.readText(
        path,
        {
          headers: {
            ...http.authHeaders,
            Accept: "text/turtle",
          },
        },
        `Read canonical entity ${path}`,
      );
      const graph = parseCanonicalTriples(body, {
        baseIRI: http.joinUrl(path),
      });
      const rootUri = graph.find(
        ([, predicate, object]) =>
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
  };

  return {
    async applyEntityPatch(request: PodEntityPatchRequest) {
      await http.ensureContainers(request.path);
      const shouldCreate = await http.ensureResourceMissing(request.path);

      if (shouldCreate) {
        if (request.retractions.length > 0) {
          throw new Error(
            `Cannot create ${request.path} from a delta that retracts triples.`,
          );
        }

        const body = await serializeCanonicalTriples(
          request.assertions,
          findRdfType(request.assertions),
        );

        await http.request(
          request.path,
          {
            method: "PUT",
            headers: {
              ...http.authHeaders,
              "Content-Type": "text/turtle",
              "If-None-Match": "*",
            },
            body,
          },
          `Create canonical entity resource for ${request.entityName}/${request.entityId}`,
        );
        return;
      }

      await http.request(
        request.path,
        {
          method: "PATCH",
          headers: {
            ...http.authHeaders,
            "Content-Type": "text/n3",
          },
          body: request.patch,
        },
        `Apply entity patch for ${request.entityName}/${request.entityId}`,
      );
    },

    async deleteEntityResource(request) {
      await http.request(
        request.path,
        {
          method: "DELETE",
          headers: http.authHeaders,
        },
        `Delete entity resource ${request.path}`,
      );
    },

    async appendLogEntry(request: PodLogAppendRequest) {
      await http.ensureContainers(request.path);
      const body = await serializeLogEntry(request);

      await http.request(
        request.path,
        {
          method: "PUT",
          headers: {
            ...http.authHeaders,
            "Content-Type": "application/n-triples",
          },
          body,
        },
        `Append remote log entry for ${request.entityName}/${request.changeId}`,
      );
    },

    async listCanonicalEntities(input) {
      return listCanonicalEntities(input);
    },

    async checkCanonicalResources(input) {
      const container = await readContainerVersion(
        input.basePath,
        input.entityName,
      );
      const version = !container.exists
        ? MISSING_CONTAINER_VERSION
        : (container.version ?? NO_VALIDATOR_CONTAINER_VERSION);
      const unchanged =
        version !== NO_VALIDATOR_CONTAINER_VERSION &&
        version === input.previousVersion;

      if (unchanged) {
        return {
          version,
          changed: false,
          entities: [],
        };
      }

      return {
        version,
        changed: true,
        entities: await listCanonicalEntities(input),
      };
    },

    async subscribeToContainer(containerPath, onNotification) {
      return subscribeToSolidContainer(
        {
          authHeaders: http.authHeaders,
          fetchImpl,
        },
        http.joinUrl(containerPath),
        onNotification,
      );
    },
  };
}
