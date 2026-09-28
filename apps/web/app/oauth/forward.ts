import { NextResponse } from "next/server";

/*
 * The two OAuth endpoints this app fronts for Stytch.
 *
 * They exist so the authorization server the client discovers is one origin
 * from end to end: it registers here, sends the user here, and redeems the
 * code here. Registration especially has to be ours to advertise, because
 * Stytch's discovery document does not mention its own.
 *
 * Nothing is rewritten on the way through. The request body and the reply are
 * passed along as they are, so these stay correct as Stytch's own contract
 * moves.
 */

/** Open, because a browser-based client reads these cross-origin. */
export function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: cors() });
}

/**
 * Pass one POST through to Stytch. Only the headers an OAuth endpoint reads
 * are forwarded: cookies in particular must not travel, or this would look
 * like a browser session rather than a client credential.
 */
export async function forward(req: Request, target: string): Promise<Response> {
  const headers = new Headers();
  for (const name of ["content-type", "authorization", "accept"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = await req.text();
  try {
    const upstream = await fetch(target, { method: "POST", headers, body });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        ...cors(),
      },
    });
  } catch (e) {
    console.error(
      "[agent-commerce] OAuth forward failed",
      target,
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { error: "server_error", error_description: "Could not reach the identity provider." },
      { status: 502, headers: cors() },
    );
  }
}
