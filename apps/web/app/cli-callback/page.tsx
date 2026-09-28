import type { Metadata } from "next";
import { CliCallback } from "@/components/cli-callback";
import { FocusScreen } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Finish CLI login" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Landing page for `agent-commerce login --code`. Stytch redirects here with `code` and
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
    <FocusScreen>
      <CliCallback code={code} state={state} error={error} />
    </FocusScreen>
  );
}
