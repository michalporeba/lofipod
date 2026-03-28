import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createSolidTestPod,
  waitForSolidServer,
} from "./support/solidServer.js";

const solidAuthBaseUrl =
  process.env.SOLID_AUTH_BASE_URL ?? "http://localhost:3500/";

describe("Community Solid Server authentication", () => {
  let podBaseUrl = "";
  let authFetch: typeof fetch = fetch;
  let logout = async () => {};

  beforeAll(async () => {
    await waitForSolidServer(solidAuthBaseUrl);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createSolidTestPod({
      baseUrl: solidAuthBaseUrl,
      email: `test-${suffix}@example.com`,
      password: "integration-test-password",
      podName: `lofipod-${suffix}`,
    });

    podBaseUrl = created.podBaseUrl;
    authFetch = created.fetch;
    logout = created.logout;
  }, 30_000);

  afterAll(async () => {
    await logout();
  });

  it("creates an authenticated session that can read a private pod root", async () => {
    const response = await authFetch(podBaseUrl);
    const body = await response.text();

    expect(response.ok).toBe(true);
    expect(body).toContain("Storage");
    expect(body).toContain("profile/");
  }, 30_000);
});
