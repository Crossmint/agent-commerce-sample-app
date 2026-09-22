import { describe, expect, it } from "vitest";
import {
  authorizationServerFromEndpoint,
  authorizationServerMetadata,
  createAgentCommerceMcpHandler,
  createAuthorizationServerMetadataHandler,
  createProtectedResourceMetadataHandler,
  protectedResourceMetadata,
} from "../src/index.js";
import { mockAgentCommerceFetch } from "./helpers.js";

const handler = createAgentCommerceMcpHandler({
  apiBaseUrl: "https://wallet.example.com/api/agent-commerce",
  resourceUrl: "https://wallet.example.com/api/mcp",
  authorizationServers: ["https://test.stytch.com/v1/public/project-test-123"],
  scopes: ["openid", "email"],
  fetch: mockAgentCommerceFetch({}),
});

function initializeRequest(token?: string): Request {
  return new Request("https://wallet.example.com/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    }),
  });
}

describe("createAgentCommerceMcpHandler", () => {
  it("returns 401 with WWW-Authenticate when no token is present", async () => {
    const res = await handler(initializeRequest());
    expect(res.status).toBe(401);
    const header = res.headers.get("WWW-Authenticate") ?? "";
    expect(header.startsWith("Bearer ")).toBe(true);
    expect(header).toContain(
      'resource_metadata="https://wallet.example.com/.well-known/oauth-protected-resource"',
    );
    expect(header).toContain('scope="openid email"');
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("answers initialize as JSON when a token is present", async () => {
    const res = await handler(initializeRequest("tok"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("mcp-session-id")).toBeNull();
    const body = (await res.json()) as {
      result: { serverInfo: { name: string }; capabilities: { tools?: unknown } };
    };
    expect(body.result.serverInfo.name).toBe("agent-commerce");
    expect(body.result.capabilities.tools).toBeDefined();
  });
});

describe("protected resource metadata", () => {
  it("builds the RFC 9728 document", () => {
    const meta = protectedResourceMetadata({
      resourceUrl: "https://wallet.example.com/api/mcp/",
      authorizationServers: ["https://test.stytch.com/v1/public/project-test-123"],
      scopes: ["openid"],
    });
    expect(meta).toEqual({
      resource: "https://wallet.example.com/api/mcp",
      authorization_servers: ["https://test.stytch.com/v1/public/project-test-123"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid"],
      resource_name: "Agent Commerce wallet",
    });
  });

  it("serves it over GET with CORS", async () => {
    const h = createProtectedResourceMetadataHandler({
      resourceUrl: "https://wallet.example.com/api/mcp",
      authorizationServers: ["https://test.stytch.com/v1/public/project-test-123"],
    });
    const res = h(new Request("https://wallet.example.com/.well-known/oauth-protected-resource"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toMatchObject({ resource: "https://wallet.example.com/api/mcp" });
  });

  it("derives the authorization server from the authorize endpoint", () => {
    expect(
      authorizationServerFromEndpoint(
        "https://test.stytch.com/v1/public/project-test-123/oauth2/authorize",
      ),
    ).toBe("https://test.stytch.com/v1/public/project-test-123");
  });
});

/*
 * The two things that stopped a client connecting on its own. Stytch serves
 * no authorization server metadata, and its openid-configuration omits the
 * registration endpoint even though the endpoint is live, so this app serves
 * the document instead.
 */
describe("authorization server metadata", () => {
  const options = {
    issuer: "https://wallet.example.com",
    authorizationEndpoint: "https://wallet.example.com/oauth/authorize",
    tokenEndpoint: "https://wallet.example.com/oauth/token",
    registrationEndpoint: "https://wallet.example.com/oauth/register",
    jwksUri: "https://test.stytch.com/v1/public/project-test-123/.well-known/jwks.json",
    scopes: ["openid", "email"],
  };

  it("advertises registration, so a client can register itself", () => {
    const meta = authorizationServerMetadata(options);
    expect(meta.registration_endpoint).toBe("https://wallet.example.com/oauth/register");
    // A public client has nothing but PKCE to prove itself with.
    expect(meta.code_challenge_methods_supported).toContain("S256");
    expect(meta.token_endpoint_auth_methods_supported).toContain("none");
  });

  it("names an issuer the client can match, with no trailing slash", () => {
    const meta = authorizationServerMetadata(options);
    expect(meta.issuer).toBe("https://wallet.example.com");
    // RFC 8414 §3.3: it has to equal the identifier the resource handed out,
    // character for character, or discovery fails on the client side.
    const resource = protectedResourceMetadata({
      resourceUrl: "https://wallet.example.com/api/mcp",
      authorizationServers: ["https://wallet.example.com"],
    });
    expect(resource.authorization_servers[0]).toBe(meta.issuer);
  });

  it("serves the document over GET with CORS, and answers preflight", async () => {
    const handle = createAuthorizationServerMetadataHandler(options);
    const res = handle(
      new Request("https://wallet.example.com/.well-known/oauth-authorization-server"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect((await res.json()).registration_endpoint).toBe(options.registrationEndpoint);

    const preflight = handle(
      new Request("https://wallet.example.com/.well-known/oauth-authorization-server", {
        method: "OPTIONS",
      }),
    );
    expect(preflight.status).toBe(204);
  });
});
