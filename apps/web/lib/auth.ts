import { cookies } from "next/headers";
import type { UserAuth } from "@agent-commerce/auth";
import { createStytchUserAuth, inferStytchEnvironment } from "@agent-commerce/auth/stytch";
import { Client as StytchClient, envs } from "stytch";
import { serverEnv } from "./env";

/** Stytch's default cookie names. The browser SDK sets both. */
export const SESSION_JWT_COOKIE = "stytch_session_jwt";
export const SESSION_TOKEN_COOKIE = "stytch_session";

export interface ServerSession {
  userId: string;
  email?: string;
  /** Stytch session id, when the JWT carries it. */
  sessionId?: string;
  /** A valid JWT. Use it as the bearer token when calling the Agent Commerce API from the server. */
  sessionJwt: string;
}

let userAuth: UserAuth | undefined;
let nodeClient: StytchClient | undefined;

/**
 * The same verifier the Agent Commerce API uses. Checks the JWT signature against the
 * Stytch JWKS. Needs only the project id.
 */
function auth(): UserAuth {
  if (userAuth) return userAuth;
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  userAuth = createStytchUserAuth({
    projectId,
    secret: serverEnv.optional("STYTCH_SECRET"),
    environment: inferStytchEnvironment(projectId),
  });
  return userAuth;
}

/** The Stytch backend SDK. Needs STYTCH_SECRET. Used to list and revoke sessions. */
function stytch(): StytchClient {
  if (nodeClient) return nodeClient;
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  nodeClient = new StytchClient({
    project_id: projectId,
    secret: serverEnv.required("STYTCH_SECRET"),
    env: projectId.startsWith("project-live-") ? envs.live : envs.test,
  });
  return nodeClient;
}

/** Emails found through Stytch's user API, by user. Per process: an email seldom changes. */
const emails = new Map<string, string>();

/**
 * The user's email. A Stytch session JWT carries it only after an email
 * login; after a Google login it holds just the OAuth factor, so ask Stytch
 * for the user's verified email instead. Without it the chat agent would ask
 * the user for an address it already has.
 */
async function emailOf(
  verifier: UserAuth,
  user: { userId: string; email?: string },
): Promise<string | undefined> {
  if (user.email) return user.email;
  const cached = emails.get(user.userId);
  if (cached) return cached;
  const found = await verifier.lookupEmail?.(user.userId).catch(() => undefined);
  if (found) emails.set(user.userId, found);
  return found;
}

function sessionIdFrom(claims: Record<string, unknown> | undefined): string | undefined {
  const s = claims?.["https://stytch.com/session"] as { id?: string } | undefined;
  return s?.id;
}

/**
 * Read the Stytch session from cookies and verify it.
 * Fresh JWT: verified locally against the JWKS. Stale JWT: exchanged for a
 * new one with the session token, when STYTCH_SECRET is set.
 * Returns null when there is no valid session.
 */
export async function getSession(): Promise<ServerSession | null> {
  const jar = await cookies();
  const jwt = jar.get(SESSION_JWT_COOKIE)?.value;
  const sessionToken = jar.get(SESSION_TOKEN_COOKIE)?.value;
  if (!jwt && !sessionToken) return null;

  let verifier: UserAuth;
  try {
    verifier = auth();
  } catch {
    return null;
  }

  if (jwt) {
    const user = await verifier.verify(jwt);
    if (user)
      return {
        userId: user.userId,
        email: await emailOf(verifier, user),
        sessionId: sessionIdFrom(user.claims),
        sessionJwt: jwt,
      };
  }

  if (sessionToken && verifier.refresh) {
    try {
      const fresh = await verifier.refresh(sessionToken);
      const user = await verifier.verify(fresh.jwt);
      if (user) {
        return {
          userId: user.userId,
          email: await emailOf(verifier, user),
          sessionId: sessionIdFrom(user.claims),
          sessionJwt: fresh.jwt,
        };
      }
    } catch {
      // fall through
    }
  }
  return null;
}

/** Revoke one of the user's sessions. Used by the connected agents list. */
export async function revokeSession(sessionId: string): Promise<void> {
  await stytch().sessions.revoke({ session_id: sessionId });
}

/** All sessions on the user. Each CLI or MCP login is one of these. */
export async function listSessions(userId: string) {
  const { sessions } = await stytch().sessions.get({ user_id: userId });
  return sessions;
}
