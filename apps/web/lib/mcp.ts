import { stytchEndpoints, inferStytchEnvironment } from "@agent-commerce/auth/stytch";
import {
  createAgentCommerceMcpHandler,
  createAuthorizationServerMetadataHandler,
  createProtectedResourceMetadataHandler,
} from "@agent-commerce/mcp";
import { serverEnv } from "./env";

/*
 * The MCP endpoint and the OAuth discovery around it.
 *
 * This app is the authorization server of record, standing in front of
 * Stytch. It has to be: Stytch serves no `/.well-known/oauth-authorization-server`
 * at all, and the `openid-configuration` it does serve omits
 * `registration_endpoint` — so a client following the spec has no way to
 * register itself and refuses to connect. Stytch's `issuer` is also
 * scheme-relative, which strict clients reject.
 *
 * So: the protected resource names this origin, this origin serves the
 * authorization server metadata, and `/oauth/token` and `/oauth/register`
 * pass through to Stytch. The consent page at `/oauth/authorize` was always
 * ours — Stytch's own metadata already points there.
 */

// No full_access: MCP hosts are third-party clients, and Crossmint accepts their
// access tokens directly, so the server never needs to exchange them.
const SCOPES = ["openid", "email", "profile", "offline_access"];

/** Stytch's OAuth endpoints, which the proxy routes forward to. */
export function stytchOAuth() {
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  return stytchEndpoints({
    projectId,
    environment: inferStytchEnvironment(projectId),
    projectDomain: serverEnv.optional("STYTCH_PROJECT_DOMAIN"),
  });
}

function mcpOptions() {
  return {
    apiBaseUrl: serverEnv.apiBaseUrl(),
    resourceUrl: `${serverEnv.webBaseUrl()}/api/mcp`,
    // This origin, not Stytch: see the note above.
    authorizationServers: [serverEnv.webBaseUrl()],
    scopes: SCOPES,
    requester: "MCP agent",
    resourceName: "Agent Commerce",
  };
}

function authorizationServerOptions() {
  const web = serverEnv.webBaseUrl();
  const ep = stytchOAuth();
  return {
    issuer: web,
    authorizationEndpoint: `${web}/oauth/authorize`,
    tokenEndpoint: `${web}/oauth/token`,
    registrationEndpoint: `${web}/oauth/register`,
    jwksUri: ep.idpJwks,
    userinfoEndpoint: ep.userinfo,
    scopes: SCOPES,
  };
}

let handler: ((req: Request) => Promise<Response>) | undefined;
let metadata: ReturnType<typeof createProtectedResourceMetadataHandler> | undefined;
let asMetadata: ReturnType<typeof createAuthorizationServerMetadataHandler> | undefined;

export function getMcpHandler() {
  handler ??= createAgentCommerceMcpHandler(mcpOptions());
  return handler;
}

export function getMcpMetadataHandler() {
  metadata ??= createProtectedResourceMetadataHandler(mcpOptions());
  return metadata;
}

export function getAuthorizationServerMetadataHandler() {
  asMetadata ??= createAuthorizationServerMetadataHandler(authorizationServerOptions());
  return asMetadata;
}
