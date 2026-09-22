import { getAuthorizationServerMetadataHandler } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/** The same document as `/.well-known/oauth-authorization-server`, for clients that only look here. */
const handle = (req: Request) => getAuthorizationServerMetadataHandler()(req);

export { handle as GET, handle as OPTIONS };
