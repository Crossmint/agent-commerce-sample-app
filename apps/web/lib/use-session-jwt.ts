"use client";

import { useCallback } from "react";
import { useStytch, useStytchSession } from "@stytch/nextjs";

/**
 * The current Stytch session JWT for `GoatProvider`'s `getJwt`.
 * `getJwt` reads the token at call time, so every API request carries the
 * latest JWT after the SDK refreshes it in the background.
 */
export function useSessionJwt() {
  const stytch = useStytch();
  const { session, isInitialized } = useStytchSession();

  const getJwt = useCallback((): string | null => {
    const tokens = stytch.session.getTokens();
    return tokens?.session_jwt ?? null;
  }, [stytch]);

  return {
    getJwt,
    session,
    /** False until the SDK has read its cookies. */
    ready: isInitialized,
    signedIn: Boolean(session),
  };
}
