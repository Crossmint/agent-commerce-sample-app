import { stytchEndpoints, inferStytchEnvironment } from "@goat-wallet/auth/stytch";
import { createGoatMcpHandler, createProtectedResourceMetadataHandler } from "@goat-wallet/mcp";
import { serverEnv } from "./env";

// No full_access: MCP hosts are third-party clients, and Crossmint accepts their
// access tokens directly, so the server never needs to exchange them.
const SCOPES = ["openid", "email", "profile", "offline_access"];

function mcpOptions() {
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  const ep = stytchEndpoints({
    projectId,
    environment: inferStytchEnvironment(projectId),
    projectDomain: serverEnv.optional("STYTCH_PROJECT_DOMAIN"),
  });
  return {
    apiBaseUrl: serverEnv.apiBaseUrl(),
    resourceUrl: `${serverEnv.webBaseUrl()}/api/mcp`,
    authorizationServers: [ep.projectDomain],
    scopes: SCOPES,
    requester: "MCP agent",
    resourceName: "GOAT",
  };
}

let handler: ((req: Request) => Promise<Response>) | undefined;
let metadata: ReturnType<typeof createProtectedResourceMetadataHandler> | undefined;

export function getMcpHandler() {
  handler ??= createGoatMcpHandler(mcpOptions());
  return handler;
}

export function getMcpMetadataHandler() {
  metadata ??= createProtectedResourceMetadataHandler(mcpOptions());
  return metadata;
}
