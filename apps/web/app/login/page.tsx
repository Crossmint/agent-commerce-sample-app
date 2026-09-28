import type { Metadata } from "next";
import { FocusScreen } from "@/components/focus-screen";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log in" };

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  // Same-origin paths only.
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/app";
  return v;
}

/** Sign in, on the phone screen. The form owns the heading: it names the step. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  return (
    <FocusScreen>
      <LoginForm next={next} />
    </FocusScreen>
  );
}
