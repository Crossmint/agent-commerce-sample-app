import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { toUser } from "./generic-jwks.js";
import type { AuthenticatedUser, ExchangedSession, UserAuth } from "./types.js";

export type StytchEnvironment = "test" | "live";

export interface StytchUserAuthOptions {
  projectId: string;
  /** Needed only for `refresh`, which calls the Stytch backend API. */
  secret?: string;
  /** Inferred from the project id prefix when omitted. */
  environment?: StytchEnvironment;
  /**
   * The project's OAuth domain from the Stytch dashboard, e.g. `https://gentle-fox-1234.customers.stytch.dev`
   * or your custom domain. Connected Apps token endpoint and JWKS live there.
   */
  projectDomain?: string;
  /** @deprecated Use `projectDomain`. */
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

export interface StytchEndpointOptions {
  projectId: string;
  environment?: StytchEnvironment;
  /** Custom Stytch domain, if you set one. Defaults to `https://<api>/v1/public/<projectId>`. */
  projectDomain?: string;
  /** @deprecated Use `projectDomain`. */
  customDomain?: string;
  /**
   * The page your app hosts for Connected Apps logins, the "Authorization URL" in the Stytch
   * dashboard. It renders Stytch's `IdentityProvider` component. E.g. `https://wallet.example.com/oauth/authorize`.
   */
  authorizationUrl?: string;
}

function normalizeDomain(d: string): string {
  const withScheme = /^https?:\/\//.test(d) ? d : `https://${d}`;
  return withScheme.replace(/\/$/, "");
}

/**
 * Endpoints Agent Commerce needs from a Stytch project.
 *
 * Connected Apps (OAuth) token and JWKS endpoints live under the project's public base,
 * `https://test.stytch.com/v1/public/<projectId>` by default. The authorize endpoint is
 * the page your app hosts (the Authorization URL in the Stytch dashboard).
 */
export function stytchEndpoints(opts: StytchEndpointOptions) {
  const env = opts.environment ?? inferStytchEnvironment(opts.projectId);
  const api = stytchApiBase(env);
  // Default: Stytch's public project base. Override only with a custom domain.
  const raw = opts.projectDomain ?? opts.customDomain;
  const domain = raw ? normalizeDomain(raw) : `${api}/v1/public/${opts.projectId}`;
  return {
    environment: env,
    api,
    /** The OAuth authorization server base. MCP hosts discover metadata under it. */
    projectDomain: domain as string,
    /** JWKS for session JWTs. */
    sessionJwks: `${api}/v1/sessions/jwks/${opts.projectId}`,
    /** JWKS for Connected Apps (OAuth) access tokens. */
    idpJwks: `${domain}/.well-known/jwks.json`,
    /** OpenID / OAuth server metadata, for MCP discovery. */
    oauthMetadata: `${domain}/.well-known/openid-configuration`,
    /** Where OAuth clients send the user. Your hosted consent page. */
    authorize: opts.authorizationUrl,
    token: `${domain}/oauth2/token`,
    revoke: `${domain}/oauth2/revoke`,
    userinfo: `${domain}/oauth2/userinfo`,
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
    // Try the session JWKS first, then the Connected Apps JWKS when a project domain is set.
    for (const [kind, jwks] of [["session", sessionJwks], ["access", idpJwks]] as const) {
      try {
        const { payload } = await jwtVerify(jwt, jwks, { clockTolerance });
        const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
        if (aud.length && !aud.includes(opts.projectId) && !aud.some((a) => a.includes(opts.projectId))) {
          // Connected Apps tokens carry the client id as audience; accept as long as issuer matches.
          const iss = payload.iss ?? "";
          const domainHost = ep.projectDomain?.replace(/^https?:\/\//, "");
          if (!iss.includes(opts.projectId) && !(domainHost && iss.includes(domainHost))) {
            continue;
          }
        }
        const user = toUser(payload, jwt);
        if (!user) continue;
        // Stytch session JWTs carry the email inside https://stytch.com/session → authentication_factors.
        if (!user.email) user.email = extractStytchEmail(payload as Record<string, unknown>);
        user.kind = kind;
        return user;
      } catch {
        // try next
      }
    }
    return null;
  }

  async function refresh(sessionToken: string): Promise<{ jwt: string; expiresAt: Date }> {
    if (!opts.secret) throw new Error("Stytch refresh needs the project secret.");
    const res = await stytchPost(ep.api, opts.projectId, opts.secret, "/v1/sessions/authenticate", {
      session_token: sessionToken,
      session_duration_minutes: opts.sessionDurationMinutes ?? 43_200,
    });
    if (!res.ok) throw new Error(`Stytch refresh failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { session_jwt: string; session: { expires_at: string } };
    const exp = decodeJwt(data.session_jwt).exp;
    return { jwt: data.session_jwt, expiresAt: exp ? new Date(exp * 1000) : new Date(data.session.expires_at) };
  }

  async function exchangeAccessToken(accessToken: string): Promise<ExchangedSession> {
    if (!opts.secret) throw new Error("Stytch access token exchange needs the project secret.");
    const call = (minutes: number) =>
      stytchPost(ep.api, opts.projectId, opts.secret!, "/v1/sessions/exchange_access_token", {
        access_token: accessToken,
        session_duration_minutes: minutes,
      });
    let res = await call(opts.sessionDurationMinutes ?? 43_200);
    if (!res.ok && (await res.clone().text()).includes("invalid_session_duration")) {
      // The project maximum is lower than requested. Take what the project allows.
      res = await call(60);
    }
    if (!res.ok) throw new Error(`Stytch access token exchange failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      session_token: string;
      session_jwt: string;
      user_id: string;
      session?: { expires_at?: string };
    };
    const exp = decodeJwt(data.session_jwt).exp;
    return {
      sessionToken: data.session_token,
      jwt: data.session_jwt,
      expiresAt: exp ? new Date(exp * 1000) : new Date(Date.now() + 5 * 60_000),
      userId: data.user_id,
    };
  }

  async function lookupEmail(userId: string): Promise<string | undefined> {
    if (!opts.secret) return undefined;
    const res = await fetch(`${ep.api}/v1/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Basic ${btoa(`${opts.projectId}:${opts.secret}`)}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { emails?: Array<{ email: string; verified?: boolean }> };
    const emails = data.emails ?? [];
    return (emails.find((e) => e.verified) ?? emails[0])?.email;
  }

  return { verify, refresh, exchangeAccessToken, lookupEmail };
}

function stytchPost(api: string, projectId: string, secret: string, path: string, body: unknown) {
  return fetch(`${api}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${projectId}:${secret}`)}`,
    },
    body: JSON.stringify(body),
  });
}

function extractStytchEmail(payload: Record<string, unknown>): string | undefined {
  const session = payload["https://stytch.com/session"] as
    | { authentication_factors?: Array<{ email_factor?: { email_address?: string } }> }
    | undefined;
  const factor = session?.authentication_factors?.find((f) => f.email_factor?.email_address);
  return factor?.email_factor?.email_address;
}
