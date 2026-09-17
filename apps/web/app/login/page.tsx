import type { Metadata } from "next";
import { GoatLockup } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  // Same-origin paths only.
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/wallet";
  return v;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="goat-backdrop flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <GoatLockup size="md" className="mb-2" />
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Sign in</h1>
        <p className="max-w-sm text-muted-foreground">Your cards. Your agents. You approve every budget.</p>
      </div>
      <LoginForm next={next} />
    </main>
  );
}
