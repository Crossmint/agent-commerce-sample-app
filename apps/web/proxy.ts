import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends signed-out visitors to /login for wallet pages. Keeps the page they
 * wanted in `next` so the approval link an agent sent still lands.
 *
 * This checks that a Stytch session cookie exists. Real verification happens
 * in the wallet layout (server) and on every API call (bearer JWT).
 */
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("stytch_session_jwt") || request.cookies.has("stytch_session");
  if (hasSession) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/wallet") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/wallet", "/wallet/:path*", "/cards/:path*", "/approve/:path*", "/checkouts/:path*", "/chat", "/chat/:path*", "/oauth/:path*"],
};
