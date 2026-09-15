export * from "./goat-api.js";
export { registerGoatTools, GOAT_TOOL_NAMES } from "./tools.js";
export type { GoatToolsContext, GoatToolName } from "./tools.js";
export {
  createGoatMcpServer,
  createGoatMcpHandler,
  createProtectedResourceMetadataHandler,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  authorizationServerFromEndpoint,
  readBearerToken,
  GOAT_MCP_SERVER_NAME,
  GOAT_MCP_SERVER_VERSION,
} from "./server.js";
export type {
  GoatMcpServerOptions,
  GoatMcpHandlerOptions,
  ProtectedResourceMetadata,
  ProtectedResourceMetadataOptions,
} from "./server.js";
