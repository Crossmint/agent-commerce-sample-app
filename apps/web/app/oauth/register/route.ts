import { stytchOAuth } from "@/lib/mcp";
import { forward, preflight } from "../forward";

export const dynamic = "force-dynamic";

/**
 * Dynamic client registration, RFC 7591. This is the endpoint whose absence
 * from Stytch's discovery document stops a client connecting on its own.
 */
export async function POST(req: Request) {
  return forward(req, stytchOAuth().register);
}

export const OPTIONS = () => preflight();
