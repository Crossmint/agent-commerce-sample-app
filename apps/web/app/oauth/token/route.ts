import { stytchOAuth } from "@/lib/mcp";
import { forward, preflight } from "../forward";

export const dynamic = "force-dynamic";

/** Code and refresh-token exchange. Advertised as this server's `token_endpoint`. */
export async function POST(req: Request) {
  return forward(req, stytchOAuth().token);
}

export const OPTIONS = () => preflight();
