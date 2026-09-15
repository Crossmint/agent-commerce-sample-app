import { describe, expect, it } from "vitest";
import {
  authorizationServerFromEndpoint,
  createGoatMcpHandler,
  createProtectedResourceMetadataHandler,
  protectedResourceMetadata,
} from "../src/index.js";
import { mockGoatFetch } from "./helpers.js";

const handler = createGoatMcpHandler({
  apiBaseUrl: "https://wallet.example.com/api/goat",
  resourceUrl: "https://wallet.example.com/api/mcp",
  authorizationServers: ["https://test.stytch.com/v1/public/project-test-123"],
  scopes: ["openid", "email"],
  fetch: mockGoatFetch({}),
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
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    }),
  });
}

describe("createGoatMcpHandler", () => {
  it("returns 401 with WWW-Authenticate when no token is present", async () => {
    const res = await handler(initializeRequest());
    expect(res.status).toBe(401);
    const header = res.headers.get("WWW-Authenticate") ?? "";
    expect(header.startsWith("Bearer ")).toBe(true);
    expect(header).toContain('resource_metadata="https://wallet.example.com/.well-known/oauth-protected-resource"');
    expect(header).toContain('scope="openid email"');
    expect(await res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("answers initialize as JSON when a token is present", async () => {
    const res = await handler(initializeRequest("tok"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("mcp-session-id")).toBeNull();
    const body = (await res.json()) as { result: { serverInfo: { name: string }; capabilities: { tools?: unknown } } };
    expect(body.result.serverInfo.name).toBe("goat");
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
      resource_name: "GOAT wallet",
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
    expect(authorizationServerFromEndpoint("https://test.stytch.com/v1/public/project-test-123/oauth2/authorize")).toBe(
      "https://test.stytch.com/v1/public/project-test-123",
    );
  });
});
