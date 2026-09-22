import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { AgentCommerceApi } from "./api.js";
import { registerAgentCommerceTools } from "./tools.js";

export const AGENT_COMMERCE_MCP_SERVER_NAME = "agent-commerce";
export const AGENT_COMMERCE_MCP_SERVER_VERSION = "0.1.0";

export interface AgentCommerceMcpServerOptions {
  /** Agent Commerce API base URL including the mount prefix, e.g. `https://wallet.example.com/api/agent-commerce`. */
  apiBaseUrl: string;
  /** The user's bearer token. Forwarded on every Agent Commerce API call. */
  bearerToken: string;
  /** Label shown to the user on the approval screen. Default "Agent". */
  requester?: string;
  fetch?: typeof fetch;
}

/**
 * Build an `McpServer` with the Agent Commerce tools bound to one user token.
 * Stateless: build one per request in HTTP mode, one per process in stdio mode.
 */
export function createAgentCommerceMcpServer(opts: AgentCommerceMcpServerOptions): McpServer {
  const server = new McpServer(
    { name: AGENT_COMMERCE_MCP_SERVER_NAME, version: AGENT_COMMERCE_MCP_SERVER_VERSION, title: "Agent Commerce wallet" },
    {
      instructions:
        "Agent Commerce lets you spend from the user's saved cards within limits the user approves. " +
        "Flow: request_agent_card → show the approval URL to the user → poll get_agent_card_request until active → " +
        "create_checkout (preferred, the server pays) or reveal_agent_card (you pay in a form). " +
        "Never show revealed card numbers to the user.",
    },
  );
  const api = new AgentCommerceApi({ baseUrl: opts.apiBaseUrl, bearerToken: opts.bearerToken, fetch: opts.fetch });
  registerAgentCommerceTools(server, { api, requester: opts.requester });
  return server;
}

// ---------------------------------------------------------------------------
// OAuth 2.0 protected resource metadata (RFC 9728)
// ---------------------------------------------------------------------------

export interface ProtectedResourceMetadataOptions {
  /** The MCP endpoint URL, e.g. `https://wallet.example.com/api/mcp`. */
  resourceUrl: string;
  /** Authorization server issuer URLs. For Stytch Connected Apps: `https://test.stytch.com/v1/public/<projectId>`. */
  authorizationServers: string[];
  scopes?: string[];
  resourceName?: string;
  resourceDocumentation?: string;
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported?: string[];
  resource_name?: string;
  resource_documentation?: string;
}

/** JSON body for `/.well-known/oauth-protected-resource`. */
export function protectedResourceMetadata(opts: ProtectedResourceMetadataOptions): ProtectedResourceMetadata {
  const metadata: ProtectedResourceMetadata = {
    resource: normalizeUrl(opts.resourceUrl),
    authorization_servers: opts.authorizationServers.map(normalizeUrl),
    bearer_methods_supported: ["header"],
    resource_name: opts.resourceName ?? "Agent Commerce wallet",
  };
  if (opts.scopes?.length) metadata.scopes_supported = opts.scopes;
  if (opts.resourceDocumentation) metadata.resource_documentation = opts.resourceDocumentation;
  return metadata;
}

/**
 * Where clients fetch the protected resource metadata: the origin's
 * `/.well-known/oauth-protected-resource`. This is the URL sent in `WWW-Authenticate`.
 */
export function protectedResourceMetadataUrl(resourceUrl: string): string {
  return new URL("/.well-known/oauth-protected-resource", resourceUrl).href;
}

/**
 * A `(req: Request) => Response` handler for the metadata route. Answers GET and
 * OPTIONS with CORS open, so browser-based MCP clients can read it.
 */
export function createProtectedResourceMetadataHandler(
  opts: ProtectedResourceMetadataOptions,
): (req: Request) => Response {
  const body = JSON.stringify(protectedResourceMetadata(opts));
  return (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (req.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET, OPTIONS", ...corsHeaders() } });
    }
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...corsHeaders() },
    });
  };
}

/**
 * Derive the authorization server URL from an authorization endpoint, e.g. the
 * one `GET /v1/config` returns: `.../oauth2/authorize` → `...`.
 */
export function authorizationServerFromEndpoint(authorizationEndpoint: string): string {
  const url = new URL(authorizationEndpoint);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/oauth2\/authorize\/?$/, "");
  return normalizeUrl(url.href);
}

// ---------------------------------------------------------------------------
// HTTP handler for Next.js route handlers and any Web-standard runtime
// ---------------------------------------------------------------------------

export interface AgentCommerceMcpHandlerOptions {
  /** Agent Commerce API base URL including the mount prefix, e.g. `https://wallet.example.com/api/agent-commerce`. */
  apiBaseUrl: string;
  /** The public URL of this MCP endpoint, e.g. `https://wallet.example.com/api/mcp`. */
  resourceUrl: string;
  /** Authorization server issuer URLs for the `WWW-Authenticate` challenge and the metadata. */
  authorizationServers: string[];
  /** Scopes to advertise. Sent in the challenge too. */
  scopes?: string[];
  /** Override the metadata URL sent in `WWW-Authenticate`. Default: origin `/.well-known/oauth-protected-resource`. */
  resourceMetadataUrl?: string;
  /** Label shown to the user on the approval screen. Default "Agent". */
  requester?: string;
  fetch?: typeof fetch;
}

/**
 * Stateless MCP over streamable HTTP. Every request gets a fresh server bound to
 * the request's bearer token. No sessions, JSON responses (no SSE), so it runs
 * in serverless route handlers.
 */
export function createAgentCommerceMcpHandler(opts: AgentCommerceMcpHandlerOptions): (req: Request) => Promise<Response> {
  const metadataUrl = opts.resourceMetadataUrl ?? protectedResourceMetadataUrl(opts.resourceUrl);

  return async (req) => {
    const token = readBearerToken(req);
    if (!token) return unauthorized(metadataUrl, opts.scopes, "Missing bearer token");

    const server = createAgentCommerceMcpServer({
      apiBaseUrl: opts.apiBaseUrl,
      bearerToken: token,
      requester: opts.requester,
      fetch: opts.fetch,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(req, { authInfo: authInfoFromToken(token) });
    } catch (err) {
      await server.close().catch(() => undefined);
      throw err;
    }
  };
}

export function readBearerToken(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

function unauthorized(metadataUrl: string, scopes: string[] | undefined, description: string): Response {
  let challenge = `Bearer error="invalid_token", error_description="${description}"`;
  if (scopes?.length) challenge += `, scope="${scopes.join(" ")}"`;
  challenge += `, resource_metadata="${metadataUrl}"`;
  return new Response(JSON.stringify({ error: "invalid_token", error_description: description }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": challenge, ...corsHeaders() },
  });
}

/**
 * Best-effort `AuthInfo` for tool handlers. The token is decoded, not verified.
 * The Agent Commerce API verifies it on every call.
 */
function authInfoFromToken(token: string): AuthInfo {
  const claims = decodeJwtClaims(token);
  const scope = typeof claims?.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];
  const clientId =
    (typeof claims?.client_id === "string" && claims.client_id) ||
    (typeof claims?.azp === "string" && claims.azp) ||
    (typeof claims?.aud === "string" && claims.aud) ||
    "unknown";
  const info: AuthInfo = { token, clientId, scopes: scope };
  if (typeof claims?.exp === "number") info.expiresAt = claims.exp;
  if (typeof claims?.sub === "string") info.extra = { userId: claims.sub };
  return info;
}

function decodeJwtClaims(token: string): Record<string, unknown> | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, mcp-session-id, mcp-protocol-version, Last-Event-ID",
    "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id, mcp-protocol-version",
  };
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  // RFC 8707 resource identifiers have no fragment. Keep the path as given, minus a trailing slash.
  u.hash = "";
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.href;
}
