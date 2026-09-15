import { getMcpHandler } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const handle = (req: Request) => getMcpHandler()(req);

export { handle as GET, handle as POST, handle as DELETE };
