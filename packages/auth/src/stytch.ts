import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { toUser } from "./generic-jwks.js";
import type { AuthenticatedUser, UserAuth } from "./types.js";

export type StytchEnvironment = "test" | "live";

export interface StytchUserAuthOptions {
  projectId: string;
  /** Needed only for `refresh`, which calls the Stytch backend API. */
  secret?: string;
  /** Inferred from the project id prefix when omitted. */
  environment?: StytchEnvironment;
  /** Your Stytch custom domain, if you set one. Used for JWKS discovery of Connected Apps tokens. */
  customDomain?: string;
  /** Session length to grant on refresh. Default 30 days. */
  sessionDurationMinutes?: number;
  clockTolerance?: number;
}

export function inferStytchEnvironment(projectId: string): StytchEnvironment {
  return projectId.startsWith("project-live-") ? "live" : "test";
}

export function stytchApiBase(env: StytchEnvironment): string {
  return env === "live" ? "https://api.stytch.com" : "https://test.stytch.com";
}

/** Endpoints GOAT needs from a Stytch project. */
export function stytchEndpoints(opts: { projectId: string; environment?: StytchEnvironment; customDomain?: string }) {
  const env = opts.environment ?? inferStytchEnvironment(opts.projectId);
  const api = stytchApiBase(env);
  const publicBase = opts.customDomain
    ? `https://${opts.customDomain.replace(/^https?:\/\//, "")}`
    : `${api}/v1/public/${opts.projectId}`;
  return {
    environment: env,
    api,
    /** JWKS for session JWTs. */
    sessionJwks: `${api}/v1/sessions/jwks/${opts.projectId}`,
    /** JWKS for Connected Apps (OAuth) access tokens. */
    idpJwks: `${publicBase}/.well-known/jwks.json`,
    /** OAuth 2.1 authorization server metadata, for MCP discovery. */
    oauthMetadata: `${publicBase}/.well-known/oauth-authorization-server`,
    authorize: `${publicBase}/oauth2/authorize`,
    token: `${publicBase}/oauth2/token`,
    revoke: `${publicBase}/oauth2/revoke`,
    issuer: `stytch.com/${opts.projectId}`,
  };
}

/**
 * Stytch adapter. Verifies both Stytch session JWTs and Connected Apps access tokens,
 * so browsers, the CLI, and MCP hosts all pass through the same `verify`.
 */
export function createStytchUserAuth(opts: StytchUserAuthOptions): UserAuth {
  const ep = stytchEndpoints(opts);
  const sessionJwks = createRemoteJWKSet(new URL(ep.sessionJwks));
  const idpJwks = createRemoteJWKSet(new URL(ep.idpJwks));
  const clockTolerance = opts.clockTolerance ?? 30;

  async function verify(jwt: string): Promise<AuthenticatedUser | null> {
    // Try the session JWKS first, then the Connected Apps JWKS.
    for (const jwks of [sessionJwks, idpJwks]) {
      try {
        const { payload } = await jwtVerify(jwt, jwks, { clockTolerance });
        const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
        if (aud.length && !aud.includes(opts.projectId) && !aud.some((a) => a.includes(opts.projectId))) {
          // Connected Apps tokens carry the client id as audience; accept as long as issuer matches.
          const iss = payload.iss ?? "";
          if (!iss.includes(opts.projectId) && !(opts.customDomain && iss.includes(opts.customDomain))) {
            continue;
          }
        }
        const user = toUser(payload, jwt);
        if (!user) continue;
        // Stytch session JWTs carry the email inside https://stytch.com/session → authentication_factors.
        if (!user.email) user.email = extractStytchEmail(payload as Record<string, unknown>);
        return user;
      } catch {
        // try next
      }
    }
    return null;
  }

  async function refresh(sessionToken: string): Promise<{ jwt: string; expiresAt: Date }> {
    if (!opts.secret) throw new Error("Stytch refresh needs the project secret.");
    const res = await fetch(`${ep.api}/v1/sessions/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${opts.projectId}:${opts.secret}`)}`,
      },
      body: JSON.stringify({
        session_token: sessionToken,
        session_duration_minutes: opts.sessionDurationMinutes ?? 43_200,
      }),
    });
    if (!res.ok) throw new Error(`Stytch refresh failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { session_jwt: string; session: { expires_at: string } };
    const exp = decodeJwt(data.session_jwt).exp;
    return { jwt: data.session_jwt, expiresAt: exp ? new Date(exp * 1000) : new Date(data.session.expires_at) };
  }

  return { verify, refresh };
}

function extractStytchEmail(payload: Record<string, unknown>): string | undefined {
  const session = payload["https://stytch.com/session"] as
    | { authentication_factors?: Array<{ email_factor?: { email_address?: string } }> }
    | undefined;
  const factor = session?.authentication_factors?.find((f) => f.email_factor?.email_address);
  return factor?.email_factor?.email_address;
}
