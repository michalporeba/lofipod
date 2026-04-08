type SolidRequestOptions = {
  podBaseUrl: string;
  authorization?: string;
  fetch?: typeof fetch;
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

  const ensureResourceMissing = async (path: string): Promise<boolean> => {
    const head = await fetchImpl(joinUrl(podBaseUrl, path), {
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
    authHeaders,
    ensureContainers,
    ensureResourceMissing,
    async request(
      path: string,
      init: RequestInit,
      context: string,
    ): Promise<Response> {
      const response = await fetchImpl(joinUrl(podBaseUrl, path), init);
      await ensureSuccess(response, context);
      return response;
    },
    async readText(
      path: string,
      init: RequestInit,
      context: string,
    ): Promise<string> {
      const response = await fetchImpl(joinUrl(podBaseUrl, path), init);
      await ensureSuccess(response, context);
      return response.text();
    },
    joinUrl(path: string): string {
      return joinUrl(podBaseUrl, path);
    },
  };
}
