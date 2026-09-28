import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends signed-out visitors to /login for the pages that only make sense with
 * a session: approving a budget, watching a checkout, authorizing an agent.
 * Keeps the page they wanted in `next` so the link an agent sent still lands.
 *
 * The app page itself is public; its frames hold their own login. This only
 * checks that a Stytch session cookie exists. Real verification happens on
 * the server render and on every API call (bearer JWT).
 */
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("stytch_session_jwt") || request.cookies.has("stytch_session");
  if (hasSession) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  const next = `${pathname}${search}`;
  if (next !== "/app") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

/*
 * Only the pages a person looks at. `/oauth/token` and `/oauth/register` are
 * called by an OAuth client with no cookie and no browser, so sending them to
 * /login would break registration and the code exchange; they must stay out
 * of this list. `/oauth/authorize` is the one OAuth path a person does open.
 */
export const config = {
  matcher: ["/approve/:path*", "/checkouts/:path*", "/oauth/authorize"],
};
