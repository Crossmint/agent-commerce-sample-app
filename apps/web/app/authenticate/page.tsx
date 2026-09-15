import type { Metadata } from "next";
import { AuthenticateClient } from "@/components/authenticate-client";

export const metadata: Metadata = { title: "Signing in" };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Stytch sends magic link and OAuth callbacks here with `token` and `stytch_token_type`. */
export default async function AuthenticatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <AuthenticateClient token={first(sp.token)} tokenType={first(sp.stytch_token_type)} />
    </main>
  );
}
