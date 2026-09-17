import type { Metadata } from "next";
import { GoatLockup } from "@/components/brand";
import { OAuthConsent } from "@/components/oauth-consent";

export const metadata: Metadata = { title: "Authorize an agent" };

/**
 * The "Authorization URL" registered in Stytch → Connected Apps. OAuth clients
 * (the goat CLI, MCP hosts) send the user here with the standard query params.
 * The proxy redirects signed-out users to /login first and brings them back
 * with the query intact. Stytch's IdentityProvider component then shows the
 * consent screen and redirects to the client's redirect_uri with the code.
 */
export default function OAuthAuthorizePage() {
  return (
    <main className="goat-backdrop flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <GoatLockup size="md" />
      <div className="goat-window w-full max-w-md p-0">
        <div className="p-5">
          <OAuthConsent />
        </div>
      </div>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        This grants the agent a login. Every budget still needs your approval on a separate screen.
      </p>
    </main>
  );
}
