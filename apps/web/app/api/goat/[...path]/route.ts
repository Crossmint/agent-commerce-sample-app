import { getGoatHandlers } from "@/lib/goat-server";

/**
 * The GOAT API from @goat-wallet/server, mounted at /api/goat.
 * The router finds the mount prefix by locating "/v1/" in the URL.
 */
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const handlers = await getGoatHandlers();
  return handlers.handler(req);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
