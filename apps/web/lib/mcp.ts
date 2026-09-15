import { stytchEndpoints, inferStytchEnvironment } from "@goat-wallet/auth/stytch";
import {
  authorizationServerFromEndpoint,
  createGoatMcpHandler,
  createProtectedResourceMetadataHandler,
} from "@goat-wallet/mcp";
import { serverEnv } from "./env";

const SCOPES = ["openid", "email", "profile", "offline_access"];

function mcpOptions() {
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  const ep = stytchEndpoints({ projectId, environment: inferStytchEnvironment(projectId) });
  return {
    apiBaseUrl: serverEnv.apiBaseUrl(),
    resourceUrl: `${serverEnv.webBaseUrl()}/api/mcp`,
    authorizationServers: [authorizationServerFromEndpoint(ep.authorize)],
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
