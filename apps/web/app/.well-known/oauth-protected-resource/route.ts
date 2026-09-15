import { getMcpMetadataHandler } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const handle = (req: Request) => getMcpMetadataHandler()(req);

export { handle as GET, handle as OPTIONS };
