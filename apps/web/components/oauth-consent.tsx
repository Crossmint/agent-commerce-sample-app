"use client";

import { IdentityProvider, useStytchSession } from "@stytch/nextjs";
import { Spinner } from "@goat-wallet/ui";

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
    <IdentityProvider
      styles={{
        container: { backgroundColor: "transparent", borderColor: "transparent", width: "100%" },
        colors: { primary: "#f3efe6", secondary: "#a8a297" },
        buttons: {
          primary: { backgroundColor: "#e8632b", textColor: "#ffffff", borderColor: "#e8632b", borderRadius: "999px" },
          secondary: { backgroundColor: "transparent", textColor: "#f3efe6", borderColor: "#3a3a30", borderRadius: "999px" },
        },
        fontFamily: "inherit",
      }}
    />
  );
}
