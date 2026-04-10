import type { Logger } from "../types.js";
import { durationSince, nowMs } from "../logger.js";

type SolidRequestOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
  getLogger?: () => Logger | undefined;
};

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, normalizeBaseUrl(baseUrl)).toString();
}

export function parentContainerPaths(path: string): string[] {
  const cleaned = path.replace(/^\/+/, "");
  const segments = cleaned.split("/").filter(Boolean);

  return segments
    .slice(0, -1)
    .map((_, index) => `${segments.slice(0, index + 1).join("/")}/`);
}

function textResponse(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

export async function ensureSuccess(
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

export function createSolidHttpClient(options: SolidRequestOptions) {
  const fetchImpl = options.fetch ?? fetch;
  const podBaseUrl = normalizeBaseUrl(options.podBaseUrl);
  const authHeaders: Record<string, string> = {};

  if (options.authorization) {
    authHeaders.Authorization = options.authorization;
  }

  const fetchWithLogging = async (
    path: string,
    init: RequestInit,
    context: string,
  ): Promise<Response> => {
    const logger = options.getLogger?.();

    if (!logger) {
      return fetchImpl(joinUrl(podBaseUrl, path), init);
    }

    const startedAt = nowMs();
    const response = await fetchImpl(joinUrl(podBaseUrl, path), init);

    logger.debug("pod:request", {
      method: init.method ?? "GET",
      url: joinUrl(podBaseUrl, path),
      status: response.status,
      durationMs: durationSince(startedAt),
      context,
    });

    return response;
  };

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

      const logger = options.getLogger?.();
      const startedAt = logger ? nowMs() : 0;
      const response = await fetchImpl(parentUrl, {
        method: "POST",
        headers: {
          ...authHeaders,
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          Slug: slug,
        },
      });

      if (logger) {
        logger.debug("pod:request", {
          method: "POST",
          url: parentUrl,
          status: response.status,
          durationMs: durationSince(startedAt),
          context: `Create container ${containerPath}`,
        });
      }

      if (response.ok || response.status === 409) {
        continue;
      }

      await ensureSuccess(response, `Create container ${containerPath}`);
    }
  };

  const ensureResourceMissing = async (path: string): Promise<boolean> => {
    const head = await fetchWithLogging(
      path,
      {
        method: "HEAD",
        headers: authHeaders,
      },
      `Check resource ${path}`,
    );

    if (head.ok) {
      return false;
    }

    if (head.status !== 404) {
      await ensureSuccess(head, `Check resource ${path}`);
    }

    return true;
  };

  return {
    authHeaders,
    ensureContainers,
    ensureResourceMissing,
    async rawRequest(path: string, init: RequestInit, context: string) {
      return fetchWithLogging(path, init, context);
    },
    async request(
      path: string,
      init: RequestInit,
      context: string,
    ): Promise<Response> {
      const response = await fetchWithLogging(path, init, context);
      await ensureSuccess(response, context);
      return response;
    },
    async readText(
      path: string,
      init: RequestInit,
      context: string,
    ): Promise<string> {
      const response = await fetchWithLogging(path, init, context);
      await ensureSuccess(response, context);
      return response.text();
    },
    joinUrl(path: string): string {
      return joinUrl(podBaseUrl, path);
    },
  };
}
