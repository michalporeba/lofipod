import { Session } from "@inrupt/solid-client-authn-node";

type CssControls = {
  controls: {
    account: {
      create: string;
      pod: string;
      clientCredentials?: string;
    };
    password: {
      create: string;
      login: string;
    };
  };
  authorization?: string;
};

async function expectOk(response: Response, context: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const detail = await response.text().catch(() => "");
  throw new Error(
    `${context} failed with ${response.status}${detail ? `: ${detail}` : ""}`,
  );
}

export async function waitForSolidServer(
  baseUrl: string,
  timeoutMs = 30_000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl);

      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until the server becomes reachable
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error(`Timed out waiting for Solid server at ${baseUrl}`);
}

export async function createSolidTestPod(input: {
  baseUrl: string;
  email: string;
  password: string;
  podName: string;
}): Promise<{
  podBaseUrl: string;
  fetch: typeof fetch;
  logout: () => Promise<void>;
}> {
  const baseUrl = input.baseUrl.endsWith("/")
    ? input.baseUrl
    : `${input.baseUrl}/`;
  const controlsResponse = await fetch(new URL(".account/", baseUrl), {
    headers: {
      Accept: "application/json",
    },
  });
  await expectOk(controlsResponse, "Read account controls");

  const controls = (await controlsResponse.json()) as CssControls;
  const createAccountResponse = await fetch(controls.controls.account.create, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  await expectOk(createAccountResponse, "Create account");

  const createdAccount = (await createAccountResponse.json()) as CssControls;
  const authorization = `CSS-Account-Token ${createdAccount.authorization ?? ""}`;

  if (authorization.endsWith(" ")) {
    throw new Error("Missing CSS account authorization token");
  }

  const authorizedControlsResponse = await fetch(
    new URL(".account/", baseUrl),
    {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
    },
  );
  await expectOk(
    authorizedControlsResponse,
    "Read authorized account controls",
  );

  const authorizedControls =
    (await authorizedControlsResponse.json()) as CssControls;

  const createPasswordResponse = await fetch(
    authorizedControls.controls.password.create,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    },
  );
  await expectOk(createPasswordResponse, "Create account password");

  const loginResponse = await fetch(
    authorizedControls.controls.password.login,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    },
  );
  await expectOk(loginResponse, "Log in to account");

  const login = (await loginResponse.json()) as {
    authorization: string;
  };
  const loggedInAuthorization = `CSS-Account-Token ${login.authorization}`;
  const loggedInControlsResponse = await fetch(new URL(".account/", baseUrl), {
    headers: {
      Authorization: loggedInAuthorization,
      Accept: "application/json",
    },
  });
  await expectOk(loggedInControlsResponse, "Read logged-in account controls");

  const loggedInControls =
    (await loggedInControlsResponse.json()) as CssControls;

  const createPodResponse = await fetch(loggedInControls.controls.account.pod, {
    method: "POST",
    headers: {
      Authorization: loggedInAuthorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.podName,
    }),
  });
  await expectOk(createPodResponse, "Create pod");
  const createdPod = (await createPodResponse.json()) as {
    pod: string;
    webId: string;
  };

  const listPodsResponse = await fetch(loggedInControls.controls.account.pod, {
    headers: {
      Authorization: loggedInAuthorization,
      Accept: "application/json",
    },
  });
  await expectOk(listPodsResponse, "List pods");

  const listedPods = (await listPodsResponse.json()) as {
    pods: Record<string, string>;
  };
  const podBaseUrl =
    Object.keys(listedPods.pods).find((url) =>
      url.endsWith(`/${input.podName}/`),
    ) ?? Object.keys(listedPods.pods)[0];

  if (!podBaseUrl) {
    throw new Error("Could not determine pod base URL");
  }

  if (!loggedInControls.controls.account.clientCredentials) {
    throw new Error("Client credentials controls are not available");
  }

  const clientCredentialsResponse = await fetch(
    loggedInControls.controls.account.clientCredentials,
    {
      method: "POST",
      headers: {
        Authorization: loggedInAuthorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `token-${input.podName}`,
        webId: createdPod.webId,
      }),
    },
  );
  await expectOk(clientCredentialsResponse, "Create client credentials");

  const clientCredentials = (await clientCredentialsResponse.json()) as {
    id: string;
    secret: string;
  };
  const session = new Session({ keepAlive: false });
  await session.login({
    clientId: clientCredentials.id,
    clientSecret: clientCredentials.secret,
    oidcIssuer: baseUrl,
  });

  if (!session.info.isLoggedIn) {
    throw new Error("Client credentials login did not produce a session");
  }

  return {
    podBaseUrl,
    fetch: session.fetch.bind(session),
    logout: () => session.logout(),
  };
}
