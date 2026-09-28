import { describe, expect, it } from "vitest";
import { ApiError, AgentCommerceApi } from "../src/api.js";
import { createConfigStore } from "../src/config.js";
import { CliExit, EXIT } from "../src/output.js";
import { fakeFetch, json, tempConfigDir } from "./helpers.js";

const base = {
  apiBaseUrl: "https://wallet.test/api/agent-commerce",
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenEndpoint: "https://test.stytch.com/v1/public/p/oauth2/token",
  clientId: "cli-app",
  tokenFromEnv: false,
};

describe("AgentCommerceApi", () => {
  it("adds the bearer header and parses bodies", async () => {
    const { fetch, calls } = fakeFetch({
      "GET /v1/me": () => json({ userId: "u1", email: "a@b.c" }),
    });
    const api = new AgentCommerceApi({
      config: { ...base, expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
      fetch,
    });
    expect(await api.me()).toEqual({ userId: "u1", email: "a@b.c" });
    expect(calls[0]?.headers.authorization).toBe("Bearer access-1");
    expect(calls[0]?.headers.accept).toBe("application/json");
  });

  it("maps the error envelope to ApiError with code and message", async () => {
    const { fetch } = fakeFetch({
      "POST /v1/agent-cards/ac_1/credentials": () =>
        json(
          { error: { code: "no_usable_rail", message: "No active rail", details: { rails: [] } } },
          409,
        ),
      "GET /v1/agent-cards/ac_2": () =>
        json({ error: { code: "unauthorized", message: "bad token" } }, 401),
      "GET /v1/agent-cards/ac_3": () =>
        new Response("<html>boom</html>", { status: 502, statusText: "Bad Gateway" }),
    });
    const api = new AgentCommerceApi({ config: base, fetch });
    const err = await api.mintCredential("ac_1", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: "no_usable_rail",
      message: "No active rail",
      status: 409,
      details: { rails: [] },
      exitCode: EXIT.ERROR,
    });
    expect(String(err)).toBe("no_usable_rail: No active rail");

    const unauth = (await api.getAgentCard("ac_2").catch((e: unknown) => e)) as ApiError;
    expect(unauth.exitCode).toBe(EXIT.NOT_LOGGED_IN);

    const html = (await api.getAgentCard("ac_3").catch((e: unknown) => e)) as ApiError;
    expect(html.code).toBe("http_502");
    expect(html.message).toContain("boom");
  });

  it("refreshes the access token when it is about to expire and persists it", async () => {
    const store = createConfigStore({ AGENT_COMMERCE_CONFIG_DIR: tempConfigDir() });
    const now = Date.now();
    const config = { ...base, expiresAt: new Date(now + 30_000).toISOString() };
    store.write(config);
    const { fetch, calls } = fakeFetch({
      "POST /oauth2/token": () =>
        json({
          access_token: "access-2",
          refresh_token: "refresh-2",
          token_type: "bearer",
          expires_in: 900,
        }),
      "GET /v1/me": () => json({ userId: "u1" }),
    });
    const api = new AgentCommerceApi({ config, fetch, store, now: () => now });
    expect(api.needsRefresh()).toBe(true);
    await api.me();
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "POST /v1/public/p/oauth2/token",
      "GET /api/agent-commerce/v1/me",
    ]);
    expect(calls[0]?.body).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: "cli-app",
    });
    expect(calls[1]?.headers.authorization).toBe("Bearer access-2");
    const saved = store.read();
    expect(saved).toMatchObject({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(new Date(saved!.expiresAt!).getTime()).toBe(now + 900_000);
    expect(saved).not.toHaveProperty("tokenFromEnv");
    // A second call does not refresh again.
    await api.me();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("does not refresh env tokens, and exits 3 when refresh fails", async () => {
    const { fetch, calls } = fakeFetch({ "GET /v1/me": () => json({ userId: "u1" }) });
    const envApi = new AgentCommerceApi({
      config: { ...base, tokenFromEnv: true, expiresAt: new Date(0).toISOString() },
      fetch,
    });
    await envApi.me();
    expect(calls).toHaveLength(1);

    const failing = fakeFetch({
      "POST /oauth2/token": () =>
        json({ error: "invalid_grant", error_description: "revoked" }, 400),
    });
    const api = new AgentCommerceApi({
      config: { ...base, expiresAt: new Date(0).toISOString() },
      fetch: failing.fetch,
    });
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CliExit);
    expect((err as CliExit).exitCode).toBe(EXIT.NOT_LOGGED_IN);
    expect((err as CliExit).message).toContain("revoked");
  });

  it("throws not-logged-in without a token", async () => {
    const api = new AgentCommerceApi({
      config: { apiBaseUrl: "https://x.test", tokenFromEnv: false },
      fetch: fakeFetch({}).fetch,
    });
    const err = await api.me().catch((e: unknown) => e);
    expect((err as CliExit).exitCode).toBe(EXIT.NOT_LOGGED_IN);
  });
});
