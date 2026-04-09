import { parseRdf } from "./solid-rdf-common.js";

const STORAGE_DESCRIPTION_REL =
  "http://www.w3.org/ns/solid/terms#storageDescription";
const NOTIFY_CHANNEL_TYPE =
  "http://www.w3.org/ns/solid/notifications#channelType";
const WEBSOCKET_CHANNEL_2023 =
  "http://www.w3.org/ns/solid/notifications#WebSocketChannel2023";
const NOTIFICATION_CONTEXT = "https://www.w3.org/ns/solid/notification/v1";
const WEBSOCKET_CLOSING_STATE = 2;

type NotificationClient = {
  authHeaders: Record<string, string>;
  fetchImpl: typeof fetch;
};

export async function subscribeToSolidContainer(
  client: NotificationClient,
  topicUrl: string,
  onNotification: () => void,
): Promise<{
  unsubscribe: () => Promise<void>;
}> {
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentSocket: WebSocket | null = null;
  let currentSubscriptionId: string | null = null;

  const connect = async (): Promise<void> => {
    const channel = await createNotificationChannel(client, topicUrl);

    if (closed) {
      await deleteNotificationChannel(client, channel.id);
      return;
    }

    currentSubscriptionId = channel.id;
    const socket = await createWebSocketClient(channel.receiveFrom);
    currentSocket = socket;

    socket.addEventListener("message", () => {
      onNotification();
    });
    socket.addEventListener("error", () => {
      socket.close();
    });
    socket.addEventListener("close", () => {
      currentSocket = null;

      if (closed) {
        return;
      }

      const subscriptionId = currentSubscriptionId;
      currentSubscriptionId = null;

      void Promise.resolve()
        .then(() =>
          subscriptionId
            ? deleteNotificationChannel(client, subscriptionId)
            : undefined,
        )
        .finally(() => {
          scheduleReconnect();
        });
    });
  };

  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect().catch(() => {
        scheduleReconnect();
      });
    }, 1_000);
  };

  await connect();

  return {
    async unsubscribe() {
      closed = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const socket = currentSocket;
      currentSocket = null;

      if (socket && socket.readyState < WEBSOCKET_CLOSING_STATE) {
        socket.close();
      }

      const subscriptionId = currentSubscriptionId;
      currentSubscriptionId = null;

      if (subscriptionId) {
        await deleteNotificationChannel(client, subscriptionId);
      }
    },
  };
}

async function createWebSocketClient(url: string): Promise<WebSocket> {
  if (typeof globalThis.WebSocket === "function") {
    return new globalThis.WebSocket(url);
  }

  const ws = await import("ws");
  return new ws.WebSocket(url) as unknown as WebSocket;
}

async function createNotificationChannel(
  client: NotificationClient,
  topicUrl: string,
): Promise<{
  id: string;
  receiveFrom: string;
}> {
  const subscriptionService = await discoverSubscriptionService(
    client,
    topicUrl,
  );
  const response = await client.fetchImpl(subscriptionService, {
    method: "POST",
    headers: {
      ...client.authHeaders,
      Accept: "application/ld+json",
      "Content-Type": "application/ld+json",
    },
    body: JSON.stringify({
      "@context": [NOTIFICATION_CONTEXT],
      type: WEBSOCKET_CHANNEL_2023,
      topic: topicUrl,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Create Solid notification channel for ${topicUrl} failed with ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const body = (await response.json()) as {
    id?: string;
    receiveFrom?: string;
  };

  if (!body.id || !body.receiveFrom) {
    throw new Error(
      `Solid notification channel response for ${topicUrl} is missing required fields.`,
    );
  }

  return {
    id: body.id,
    receiveFrom: body.receiveFrom,
  };
}

async function discoverSubscriptionService(
  client: NotificationClient,
  topicUrl: string,
): Promise<string> {
  const headResponse = await client.fetchImpl(topicUrl, {
    method: "HEAD",
    headers: client.authHeaders,
  });

  if (!headResponse.ok) {
    const detail = await headResponse.text().catch(() => "");
    throw new Error(
      `Discover Solid notifications for ${topicUrl} failed with ${headResponse.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const storageDescription = readLinkHeaderTarget(
    headResponse.headers.get("link"),
    STORAGE_DESCRIPTION_REL,
    topicUrl,
  );

  if (!storageDescription) {
    throw new Error(
      `Storage description link for ${topicUrl} was not advertised by the server.`,
    );
  }

  const descriptionResponse = await client.fetchImpl(storageDescription, {
    headers: {
      ...client.authHeaders,
      Accept: "text/turtle",
    },
  });

  if (!descriptionResponse.ok) {
    const detail = await descriptionResponse.text().catch(() => "");
    throw new Error(
      `Read storage description for ${topicUrl} failed with ${descriptionResponse.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const descriptionBody = await descriptionResponse.text();
  const quads = parseRdf(descriptionBody, {
    format: "text/turtle",
    baseIRI: storageDescription,
  });
  const service = quads.find(
    (quad) =>
      quad.subject.termType === "NamedNode" &&
      quad.predicate.termType === "NamedNode" &&
      quad.predicate.value === NOTIFY_CHANNEL_TYPE &&
      quad.object.termType === "NamedNode" &&
      quad.object.value === WEBSOCKET_CHANNEL_2023,
  )?.subject;

  if (!service || service.termType !== "NamedNode") {
    throw new Error(
      `Storage description for ${topicUrl} did not advertise WebSocket notifications.`,
    );
  }

  return service.value;
}

async function deleteNotificationChannel(
  client: NotificationClient,
  channelId: string,
): Promise<void> {
  try {
    await client.fetchImpl(channelId, {
      method: "DELETE",
    });
  } catch {
    // Cleanup is best-effort.
  }
}

function readLinkHeaderTarget(
  linkHeader: string | null,
  rel: string,
  baseUrl: string,
): string | null {
  if (!linkHeader) {
    return null;
  }

  for (const segment of linkHeader.split(",")) {
    const [targetPart, ...parameterParts] = segment
      .split(";")
      .map((part) => part.trim());
    const target = targetPart?.match(/^<(.+)>$/)?.[1];

    if (!target) {
      continue;
    }

    const relation = parameterParts
      .map((part) => part.match(/^rel="?([^"]+)"?$/)?.[1])
      .find(Boolean);

    if (relation === rel) {
      return new URL(target, baseUrl).toString();
    }
  }

  return null;
}
