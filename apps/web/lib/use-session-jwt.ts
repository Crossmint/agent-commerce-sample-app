"use client";

import { useCallback } from "react";
import { useStytch, useStytchSession } from "@stytch/nextjs";

/**
 * The current Stytch session JWT for `AgentCommerceProvider`'s `getJwt`.
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

  /**
   * A fresh JWT, for a request that came back 401: the one the SDK held had
   * expired, as it does when a tab sleeps past its lifetime. Null when the
   * session itself is gone.
   */
  const renewJwt = useCallback(async (): Promise<string | null> => {
    try {
      await stytch.session.authenticate();
    } catch {
      return null;
    }
    return stytch.session.getTokens()?.session_jwt ?? null;
  }, [stytch]);

  return {
    getJwt,
    renewJwt,
    session,
    /** False until the SDK has read its cookies. */
    ready: isInitialized,
    signedIn: Boolean(session),
  };
}
