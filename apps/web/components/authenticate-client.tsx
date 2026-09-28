"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStytch } from "@stytch/nextjs";
import { AlertCircle } from "lucide-react";
import { Button, Spinner } from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";
import { NEXT_COOKIE } from "./login-form";
import { authenticateWithSessionFallback } from "@/lib/stytch-client";

const DEFAULT_NEXT = "/app";

function readNextCookie(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${NEXT_COOKIE}=`));
  const raw = match ? decodeURIComponent(match.slice(NEXT_COOKIE.length + 1)) : DEFAULT_NEXT;
  document.cookie = `${NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : DEFAULT_NEXT;
}

type TokenKind = "magic_links" | "oauth";

function tokenKind(tokenType: string | undefined): TokenKind | null {
  return tokenType === "magic_links" || tokenType === "oauth" ? tokenType : null;
}

/**
 * Finishes a redirect-based login. Google's callback lands here; email sign-in
 * uses a passcode and never leaves /login, so the magic-link branch is kept
 * only for links that were already sent.
 *
 * The page is the phone screen: the step's name, then a spinner while the
 * token is exchanged, or the fault and a way back to /login.
 */
export function AuthenticateClient({ token, tokenType }: { token?: string; tokenType?: string }) {
  const stytch = useStytch();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const kind = tokenKind(tokenType);
  const linkProblem = !token
    ? "This link has no token. Ask for a new one."
    : !kind
      ? `Unknown token type "${tokenType ?? ""}".`
      : null;

  useEffect(() => {
    if (!token || !kind || started.current) return;
    started.current = true;
    const authenticate = async (minutes: number): Promise<void> => {
      const opts = { session_duration_minutes: minutes };
      if (kind === "oauth") await stytch.oauth.authenticate(token, opts);
      else await stytch.magicLinks.authenticate(token, opts);
    };
    authenticateWithSessionFallback(authenticate)
      .then(() => {
        const next = readNextCookie();
        router.replace(next);
        router.refresh();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not sign you in.");
      });
  }, [stytch, router, token, kind]);

  const message = linkProblem ?? error;
  if (message) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <ScreenHeading title="Sign in did not finish" sub="Nothing was changed on your account." />
        <div role="alert" className="flex items-start gap-3">
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Could not sign you in</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-auto">
          <Button asChild size="xl" className="w-full">
            <Link href="/login">Try again</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <ScreenHeading title="Signing you in" sub="One moment." />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Checking your login…
      </p>
    </div>
  );
}
