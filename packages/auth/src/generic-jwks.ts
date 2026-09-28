import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthenticatedUser, UserAuth } from "./types.js";

export interface JwksUserAuthOptions {
  jwksUrl: string | URL;
  issuer?: string | string[];
  audience?: string | string[];
  /** Claim that holds the user id. Default `sub`. */
  userIdClaim?: string;
  emailClaim?: string;
  /** Leeway in seconds for clock skew. Default 30. */
  clockTolerance?: number;
}

/**
 * Verify JWTs from any provider that publishes a JWKS. Use this when your platform
 * already has auth and only needs to hand Agent Commerce a JWT. Register the same JWKS URL in
 * the Crossmint console as a custom JWT provider.
 */
export function createJwksUserAuth(opts: JwksUserAuthOptions): UserAuth {
  const jwks = createRemoteJWKSet(new URL(opts.jwksUrl));
  const userIdClaim = opts.userIdClaim ?? "sub";
  const emailClaim = opts.emailClaim ?? "email";
  return {
    async verify(jwt) {
      try {
        const { payload } = await jwtVerify(jwt, jwks, {
          issuer: opts.issuer,
          audience: opts.audience,
          clockTolerance: opts.clockTolerance ?? 30,
        });
        return toUser(payload, jwt, userIdClaim, emailClaim);
      } catch {
        return null;
      }
    },
  };
}

export function toUser(
  payload: JWTPayload,
  jwt: string,
  userIdClaim = "sub",
  emailClaim = "email",
): AuthenticatedUser | null {
  const id = payload[userIdClaim];
  if (typeof id !== "string" || !id) return null;
  const email = payload[emailClaim];
  return {
    userId: id,
    email: typeof email === "string" ? email : undefined,
    claims: payload as Record<string, unknown>,
    jwt,
  };
}
