import { Suspense } from "react";
import type { Metadata } from "next";
import { FocusScreen } from "@/components/focus-screen";
import { OAuthConsent } from "@/components/oauth-consent";

export const metadata: Metadata = { title: "Authorize an agent" };

/**
 * The "Authorization URL" registered in Stytch → Connected Apps. OAuth clients
 * (the agent-commerce CLI, MCP hosts) send the user here with the standard query params.
 * The proxy redirects signed-out users to /login first and brings them back
 * with the query intact, so this page lands on the same ground they just left.
 *
 * No phone mockup here, and Acme's logotype rather than Crossmint's. The
 * other standalone screens are shown off as part of the sample; this one is
 * a real gate that a real agent sends a person to, so it is the page itself,
 * and the brand on it is the one asking for access.
 */
export default function OAuthAuthorizePage() {
  return (
    <FocusScreen frame={false} brand="agent">
      {/* The consent screen owns its heading: it names the app asking. It
          reads the OAuth request from the query, so it waits behind a
          Suspense boundary like any other `useSearchParams` reader. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <OAuthConsent />
      </Suspense>
    </FocusScreen>
  );
}
