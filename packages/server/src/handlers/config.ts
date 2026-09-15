import { stytchEndpoints } from "@goat-wallet/auth";
import type { Ctx } from "../context.js";
import { json } from "../errors.js";
import type { PublicConfig } from "../types.js";

export function buildPublicConfig(ctx: Ctx): PublicConfig {
  const { config } = ctx;
  const ep = stytchEndpoints({
    projectId: config.auth.projectId,
    environment: config.auth.environment,
    customDomain: config.auth.customDomain,
  });
  const oauth: PublicConfig["auth"]["oauth"] = {
    authorizationEndpoint: ep.authorize,
    tokenEndpoint: ep.token,
    scopes: ["openid", "email", "profile", "offline_access"],
  };
  if (config.auth.cliClientId) oauth.cliClientId = config.auth.cliClientId;
  if (config.auth.mcpClientId) oauth.mcpClientId = config.auth.mcpClientId;
  return {
    name: config.name ?? "GOAT",
    apiBaseUrl: config.apiBaseUrl,
    webBaseUrl: config.webBaseUrl,
    crossmintEnvironment: config.crossmint.environment,
    auth: {
      provider: "stytch",
      projectId: config.auth.projectId,
      environment: config.auth.environment,
      oauth,
    },
  };
}

/** GET /v1/config. No auth. */
export async function getConfig(_req: Request, ctx: Ctx): Promise<Response> {
  return json(buildPublicConfig(ctx));
}
