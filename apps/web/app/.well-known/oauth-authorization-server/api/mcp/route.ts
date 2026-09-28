import { getAuthorizationServerMetadataHandler } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const handle = (req: Request) => getAuthorizationServerMetadataHandler()(req);

export { handle as GET, handle as OPTIONS };
