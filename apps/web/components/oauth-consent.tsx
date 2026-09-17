"use client";

import { IdentityProvider, useStytchSession } from "@stytch/nextjs";
import { Spinner } from "@goat-wallet/ui";
import { stytchPresentation } from "@/lib/stytch-styles";

/**
 * Stytch's Connected Apps consent screen. It reads client_id, redirect_uri,
 * scope, state and PKCE params from the URL, asks the signed-in user to
 * approve, and redirects back to the client with an authorization code.
 */
export function OAuthConsent() {
  const { session, isInitialized } = useStytchSession();
  if (!isInitialized || !session) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  return (
    <IdentityProvider presentation={stytchPresentation} />
  );
}
