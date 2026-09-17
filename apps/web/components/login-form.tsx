"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { OAuthProviders, Products, StytchLogin, useStytchSession, type StytchLoginConfig } from "@stytch/nextjs";
import { Spinner } from "@goat-wallet/ui";
import { SESSION_MINUTES } from "@/lib/stytch-client";
import { stytchPresentation } from "@/lib/stytch-styles";

export const NEXT_COOKIE = "goat_next";


const noop = () => () => {};
/** window.location.origin on the client, null during server rendering. */
function useOrigin(): string | null {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  );
}

/**
 * Stytch's prebuilt login: email magic link and Google.
 * Stytch redirects back to /authenticate. The page the user wanted travels in
 * a short-lived cookie, since redirect URLs must match the dashboard exactly.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { session, isInitialized } = useStytchSession();
  const origin = useOrigin();

  useEffect(() => {
    document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=900; SameSite=Lax`;
  }, [next]);

  useEffect(() => {
    if (isInitialized && session) router.replace(next);
  }, [isInitialized, session, next, router]);

  if (!origin || !isInitialized || session) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const redirectURL = `${origin}/authenticate`;
  const config: StytchLoginConfig = {
    products: [Products.emailMagicLinks, Products.oauth],
    emailMagicLinksOptions: {
      loginRedirectURL: redirectURL,
      signupRedirectURL: redirectURL,
      loginExpirationMinutes: 30,
      signupExpirationMinutes: 30,
    },
    oauthOptions: {
      providers: [{ type: OAuthProviders.Google }],
      loginRedirectURL: redirectURL,
      signupRedirectURL: redirectURL,
    },
    sessionOptions: { sessionDurationMinutes: SESSION_MINUTES },
  };

  return (
    <div className="goat-window w-full max-w-md">
      <div className="p-2">
        <StytchLogin config={config} presentation={stytchPresentation} />
      </div>
    </div>
  );
}
