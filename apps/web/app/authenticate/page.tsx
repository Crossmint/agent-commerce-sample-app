import type { Metadata } from "next";
import { AuthenticateClient } from "@/components/authenticate-client";
import { FocusScreen } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Signing in" };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Stytch sends magic link and OAuth callbacks here with `token` and
 * `stytch_token_type`. The same phone screen as sign in, since the user just
 * left it.
 */
export default async function AuthenticatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <FocusScreen>
      <AuthenticateClient token={first(sp.token)} tokenType={first(sp.stytch_token_type)} />
    </FocusScreen>
  );
}
