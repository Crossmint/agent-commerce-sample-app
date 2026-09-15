import type { Metadata } from "next";
import Image from "next/image";
import { CliCallback } from "@/components/cli-callback";

export const metadata: Metadata = { title: "Finish CLI login" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Landing page for `goat login --code`. Stytch redirects here with `code` and
 * `state`. The user pastes them back into the terminal. No login needed here.
 */
export default async function CliCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = one(params.code);
  const state = one(params.state);
  const error = one(params.error_description) ?? one(params.error);
  return (
    <main className="goat-backdrop flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <Image src="/brand/logo.png" alt="GOAT" width={160} height={50} priority className="h-12 w-auto" />
      <CliCallback code={code} state={state} error={error} />
    </main>
  );
}
