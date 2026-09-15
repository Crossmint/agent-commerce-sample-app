export interface AuthenticatedUser {
  /** Stable user id. With Stytch this is the `sub` claim, e.g. `user-test-...`. */
  userId: string;
  email?: string;
  /** Raw claims, for adapters that need more. */
  claims?: Record<string, unknown>;
  /** The JWT that authenticated this request, forwarded to Crossmint as is. */
  jwt: string;
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
}

/** Read a bearer token from a Request. Returns null when absent. */
export function bearerToken(req: Request | Headers): string | null {
  const headers = req instanceof Request ? req.headers : req;
  const header = headers.get("authorization") ?? headers.get("Authorization");
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}
