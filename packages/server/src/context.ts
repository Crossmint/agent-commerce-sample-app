import { bearerToken, type AuthenticatedUser } from "@agent-commerce/auth";
import { CrossmintClient, DEFAULT_RAIL_PREFERENCE, type RailKind } from "@agent-commerce/core";
import { z } from "zod";
import { invalidRequest, unauthorized } from "./errors.js";
import { memoryCheckoutStore, memoryRevealStore, memorySessionStore } from "./store/memory.js";
import type {
  AgentSession,
  CheckoutStore,
  AgentCommerceServerConfig,
  RequestStore,
  RevealStore,
  SessionStore,
} from "./types.js";

export interface Ctx {
  config: AgentCommerceServerConfig;
  crossmint: CrossmintClient;
  store: RequestStore;
  checkouts: CheckoutStore;
  sessions: SessionStore;
  reveals: RevealStore;
  requestTtlMinutes: number;
  defaultRequester: string;
  railPreference: RailKind[];
  now(): Date;
}

export function createContext(config: AgentCommerceServerConfig): Ctx {
  const crossmint = new CrossmintClient({
    clientApiKey: config.crossmint.clientApiKey,
    serverApiKey: config.crossmint.serverApiKey,
    environment: config.crossmint.environment,
    baseUrl: config.crossmint.baseUrl,
    checkoutsBaseUrl: config.crossmint.checkoutsBaseUrl,
    origin: config.crossmint.origin ?? config.webBaseUrl,
    fetch: config.crossmint.fetch,
  });

  let checkouts: CheckoutStore;
  if (
    typeof config.store.linkCheckout === "function" &&
    typeof config.store.getCheckout === "function"
  ) {
    checkouts = config.store as RequestStore & CheckoutStore;
  } else {
    console.warn(
      "[agent-commerce] store has no linkCheckout/getCheckout. Falling back to an in-memory map. " +
        "Checkout to agent card links are lost on restart.",
    );
    checkouts = memoryCheckoutStore();
  }

  let sessions: SessionStore;
  if (typeof config.store.getSession === "function" && typeof config.store.putSession === "function") {
    sessions = config.store as RequestStore & SessionStore;
  } else {
    console.warn(
      "[agent-commerce] store has no getSession/putSession. Falling back to an in-memory map. " +
        "Agents must log in again after a restart.",
    );
    sessions = memorySessionStore();
  }

  let reveals: RevealStore;
  if (typeof config.store.recordReveal === "function" && typeof config.store.listReveals === "function") {
    reveals = config.store as RequestStore & RevealStore;
  } else {
    console.warn(
      "[agent-commerce] store has no recordReveal/listReveals. Falling back to an in-memory list. " +
        "Transactions are lost on restart.",
    );
    reveals = memoryRevealStore();
  }

  return {
    config,
    crossmint,
    store: config.store,
    checkouts,
    reveals,
    sessions,
    requestTtlMinutes: config.requestTtlMinutes ?? 15,
    defaultRequester: config.defaultRequester ?? "Agent",
    railPreference: config.railPreference ?? DEFAULT_RAIL_PREFERENCE,
    now: () => new Date(),
  };
}

/** Verify the bearer token. Throws 401 when it is missing or invalid. */
export async function requireUser(req: Request, ctx: Ctx): Promise<AuthenticatedUser> {
  const token = bearerToken(req);
  if (!token) throw unauthorized("Missing Authorization: Bearer <jwt>");
  const user = await ctx.config.userAuth.verify(token);
  if (!user) throw unauthorized("Invalid or expired token");
  if (user.kind !== "access") return { ...user, jwt: user.jwt || token };
  // An agent's OAuth access token. Crossmint verifies session JWTs, so swap it for one.
  const jwt = await sessionJwtForAccessToken(token, user.userId, ctx);
  return { ...user, jwt, kind: "session" };
}

/** Refresh the session JWT this many ms before it expires. */
const JWT_REFRESH_MARGIN_MS = 30_000;

async function sessionJwtForAccessToken(accessToken: string, userId: string, ctx: Ctx): Promise<string> {
  const auth = ctx.config.userAuth;
  const hash = await sha256Base64Url(accessToken);
  const now = ctx.now();
  const existing = await ctx.sessions.getSession(hash);

  if (existing) {
    if (new Date(existing.jwtExpiresAt).getTime() - now.getTime() > JWT_REFRESH_MARGIN_MS) {
      return existing.jwt;
    }
    if (!auth.refresh) throw unauthorized("Agent session expired and the auth adapter cannot refresh it.");
    const fresh = await auth.refresh(existing.sessionToken);
    await ctx.sessions.putSession({
      ...existing,
      jwt: fresh.jwt,
      jwtExpiresAt: fresh.expiresAt.toISOString(),
      updatedAt: now.toISOString(),
    });
    return fresh.jwt;
  }

  if (!auth.exchangeAccessToken) {
    throw unauthorized("This server cannot exchange agent access tokens. Configure the auth adapter with a secret.");
  }
  let exchanged;
  try {
    exchanged = await auth.exchangeAccessToken(accessToken);
  } catch (e) {
    console.warn("[agent-commerce] access token exchange failed", e instanceof Error ? e.message : e);
    throw unauthorized(
      "Could not exchange the agent access token for a session. The token may be older than five minutes, " +
        "or the Connected App is not first-party with full access. Log in again.",
    );
  }
  const session: AgentSession = {
    accessTokenHash: hash,
    userId: exchanged.userId || userId,
    sessionToken: exchanged.sessionToken,
    jwt: exchanged.jwt,
    jwtExpiresAt: exchanged.expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await ctx.sessions.putSession(session);
  return session.jwt;
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  let s = "";
  for (const b of new Uint8Array(digest)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parse a JSON body with a zod schema. Throws 400 on failure. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<z.output<T>> {
  let raw: unknown;
  const text = await req.text();
  if (!text) {
    raw = {};
  } else {
    try {
      raw = JSON.parse(text);
    } catch {
      throw invalidRequest("Body is not valid JSON");
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw invalidRequest("Invalid request body", { issues: result.error.issues });
  }
  return result.data;
}

const emailCache = new Map<string, string>();

/**
 * Email for Crossmint card registration: the body, then the token, then a lookup
 * through the auth adapter. Throws 400 when none is available.
 */
export async function resolveEmail(
  user: AuthenticatedUser,
  ctx: Ctx,
  fromBody?: string,
): Promise<string> {
  const email = fromBody ?? user.email ?? (await lookupEmail(user.userId, ctx));
  if (!email) {
    throw invalidRequest(
      "No email is known for this account. Pass `email`, or configure the auth adapter with a secret so it can look the email up.",
    );
  }
  return email;
}

export async function lookupEmail(userId: string, ctx: Ctx): Promise<string | undefined> {
  const cached = emailCache.get(userId);
  if (cached) return cached;
  const found = await ctx.config.userAuth.lookupEmail?.(userId).catch(() => undefined);
  if (found) emailCache.set(userId, found);
  return found;
}
