import { describe, expect, it } from "vitest";
import { parsePastedCode } from "../src/login.js";
import { runCli } from "../src/program.js";
import { EXIT } from "../src/output.js";
import { fakeFetch, json, stripAnsi, testContext } from "./helpers.js";

const publicConfig = {
  name: "Agent Commerce",
  apiBaseUrl: "https://wallet.test/api/agent-commerce",
  webBaseUrl: "https://wallet.test",
  crossmintEnvironment: "staging",
  auth: {
    provider: "stytch",
    projectId: "project-test-1",
    environment: "test",
    oauth: {
      authorizationEndpoint: "https://test.stytch.com/v1/public/project-test-1/oauth2/authorize",
      tokenEndpoint: "https://test.stytch.com/v1/public/project-test-1/oauth2/token",
      cliClientId: "connected-app-cli",
      scopes: ["openid", "email", "offline_access"],
    },
  },
};

describe("parsePastedCode", () => {
  it("accepts a code, a query, or a URL", () => {
    expect(parsePastedCode("abc")).toEqual({ code: "abc" });
    expect(parsePastedCode("code=abc&state=s1")).toEqual({ code: "abc", state: "s1" });
    expect(parsePastedCode("https://wallet.test/cli-callback?state=s1&code=abc")).toEqual({
      code: "abc",
      state: "s1",
    });
    expect(parsePastedCode("")).toEqual({});
  });
});

describe("agent-commerce login --code", () => {
  it("runs PKCE against /v1/config endpoints and saves the session", async () => {
    let printedUrl = "";
    const { fetch, calls } = fakeFetch({
      "GET /v1/config": () => json(publicConfig),
      "POST /oauth2/token": () =>
        json({ access_token: "at", refresh_token: "rt", token_type: "bearer", expires_in: 3600 }),
      "GET /v1/me": () => json({ userId: "user-test-1", email: "ada@example.com" }),
    });
    const t = testContext({ fetch, config: null });
    t.overrides.prompt = async () => {
      const state = new URL(printedUrl).searchParams.get("state");
      return `https://wallet.test/cli-callback?code=the-code&state=${state}`;
    };
    const err = t.overrides.err!;
    t.overrides.err = (line = "") => {
      // The CLI prints the URL in cyan. Strip the colour first, as the
      // harness does for stderr: the reset code is not whitespace, so `\S+`
      // would carry it into the query string. CI runs with colour on.
      const m = /https:\/\/test\.stytch\.com\S+/.exec(stripAnsi(line));
      if (m) printedUrl = m[0];
      err(line);
    };
    const code = await runCli(
      ["login", "--api", "https://wallet.test/api/agent-commerce/", "--code"],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    const authorize = new URL(printedUrl);
    expect(authorize.searchParams.get("client_id")).toBe("connected-app-cli");
    expect(authorize.searchParams.get("redirect_uri")).toBe("https://wallet.test/cli-callback");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("scope")).toBe("openid email offline_access");
    const tokenCall = calls.find((c) => c.url.endsWith("/oauth2/token"));
    expect(tokenCall?.body).toMatchObject({
      grant_type: "authorization_code",
      code: "the-code",
      redirect_uri: "https://wallet.test/cli-callback",
      client_id: "connected-app-cli",
    });
    expect((tokenCall?.body as { code_verifier: string }).code_verifier).toBeTruthy();
    expect(t.store.read()).toMatchObject({
      apiBaseUrl: "https://wallet.test/api/agent-commerce",
      accessToken: "at",
      refreshToken: "rt",
      tokenEndpoint: publicConfig.auth.oauth.tokenEndpoint,
      clientId: "connected-app-cli",
      userId: "user-test-1",
      email: "ada@example.com",
    });
    expect(t.stdout.join("\n")).toContain("Logged in as ada@example.com");
  });

  it("fails without an API URL", async () => {
    const t = testContext({ fetch: fakeFetch({}).fetch, config: null });
    expect(await runCli(["login"], t.overrides)).toBe(EXIT.ERROR);
    expect(t.stderr.join("\n")).toContain("--api");
  });
});
