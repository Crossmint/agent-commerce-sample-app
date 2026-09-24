/**
 * GET /ucp/agent-profile.json: this agent's UCP profile.
 *
 * Shopify's catalog reads it on every search the chat agent makes (see
 * `lib/chat/shopify-catalog.ts`) to learn what the agent can do. The agent
 * only searches and looks products up there; it buys through Agent
 * Checkouts, so the profile says catalog and nothing else.
 */
const VERSION = "2026-08-25";

const PROFILE = {
  ucp: {
    version: VERSION,
    services: {
      "dev.ucp.shopping": [
        {
          version: VERSION,
          spec: `https://ucp.dev/${VERSION}/specification/overview`,
          transport: "mcp",
          schema: `https://ucp.dev/${VERSION}/services/shopping/mcp.openrpc.json`,
        },
      ],
    },
    capabilities: {
      "dev.ucp.shopping.catalog.search": [
        {
          version: VERSION,
          spec: `https://ucp.dev/${VERSION}/specification/catalog/search`,
          schema: `https://ucp.dev/${VERSION}/schemas/shopping/catalog_search.json`,
        },
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          version: VERSION,
          spec: `https://ucp.dev/${VERSION}/specification/catalog/lookup`,
          schema: `https://ucp.dev/${VERSION}/schemas/shopping/catalog_lookup.json`,
        },
      ],
      "dev.shopify.catalog.global": [
        {
          version: VERSION,
          spec: "https://shopify.dev/docs/agents/catalog/global-catalog",
          schema: `https://shopify.dev/ucp/schemas/${VERSION}/shopify_catalog_global.json`,
          extends: ["dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.catalog.search"],
        },
      ],
    },
    payment_handlers: {},
  },
};

export function GET(): Response {
  return Response.json(PROFILE, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
