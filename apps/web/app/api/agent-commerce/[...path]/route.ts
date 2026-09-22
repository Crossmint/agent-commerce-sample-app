import { getAgentCommerceHandlers } from "@/lib/api-server";

/**
 * The Agent Commerce API from @agent-commerce/server, mounted at /api/agent-commerce.
 * The router finds the mount prefix by locating "/v1/" in the URL.
 */
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const handlers = await getAgentCommerceHandlers();
  return handlers.handler(req);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
