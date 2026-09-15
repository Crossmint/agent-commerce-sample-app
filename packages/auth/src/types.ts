export interface AuthenticatedUser {
  /** Stable user id. With Stytch this is the `sub` claim, e.g. `user-test-...`. */
  userId: string;
  email?: string;
  /** Raw claims, for adapters that need more. */
  claims?: Record<string, unknown>;
  /** The JWT that authenticated this request. Session JWTs go to Crossmint as is. */
  jwt: string;
  /**
   * "session": a session JWT the auth provider's JWKS verifies, safe to forward to Crossmint.
   * "access": an OAuth access token from an agent (CLI, MCP). The server exchanges it for
   * a session first. Undefined when the adapter cannot tell.
   */
  kind?: "session" | "access";
}

export interface ExchangedSession {
  /** Long-lived opaque session token. Store it server side. Refresh JWTs with it. */
  sessionToken: string;
  /** Short-lived session JWT, verifiable by Crossmint. */
  jwt: string;
  expiresAt: Date;
  userId: string;
}

/**
 * The whole bring-your-own-auth contract.
 *
 * Every GOAT caller (browser, CLI, MCP host) sends `Authorization: Bearer <jwt>`.
 * `verify` says who that is. The server then forwards the same JWT to Crossmint,
 * which verifies it against the same provider's JWKS.
 */
export interface UserAuth {
  verify(jwt: string): Promise<AuthenticatedUser | null>;
  /**
   * Optional. Turn a long-lived session (Stytch session token, OAuth refresh token)
   * into a fresh short-lived JWT. Agents use this to stay logged in for days.
   */
  refresh?(session: string): Promise<{ jwt: string; expiresAt: Date }>;
  /**
   * Optional. Turn an OAuth access token from a first-party client into a session.
   * Stytch: `POST /v1/sessions/exchange_access_token`. The token must be under five
   * minutes old and is exchanged once, so the server stores the result.
   */
  exchangeAccessToken?(accessToken: string): Promise<ExchangedSession>;
  /**
   * Optional. Find the user's email when the token has none, for example after a
   * Google login where the JWT only carries an OAuth factor. Crossmint needs an
   * email to register a card for agent cards.
   */
  lookupEmail?(userId: string): Promise<string | undefined>;
}

/** Read a bearer token from a Request. Returns null when absent. */
export function bearerToken(req: Request | Headers): string | null {
  const headers = req instanceof Request ? req.headers : req;
  const header = headers.get("authorization") ?? headers.get("Authorization");
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}
