"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStytch } from "@stytch/nextjs";
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from "@goat-wallet/ui";
import { NEXT_COOKIE } from "./login-form";
import { FALLBACK_SESSION_MINUTES, SESSION_MINUTES, isSessionDurationError } from "@/lib/stytch-client";

function readNextCookie(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${NEXT_COOKIE}=`));
  const raw = match ? decodeURIComponent(match.slice(NEXT_COOKIE.length + 1)) : "/wallet";
  document.cookie = `${NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/wallet";
}

type TokenKind = "magic_links" | "oauth";

function tokenKind(tokenType: string | undefined): TokenKind | null {
  return tokenType === "magic_links" || tokenType === "oauth" ? tokenType : null;
}

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
    // If the project's maximum session duration is lower than what we ask for,
    // retry once with a short session instead of failing the login.
    authenticate(SESSION_MINUTES)
      .catch((e: unknown) => {
        if (!isSessionDurationError(e)) throw e;
        console.warn("[goat] Session duration above the Stytch project maximum. Retrying with", FALLBACK_SESSION_MINUTES, "minutes.");
        return authenticate(FALLBACK_SESSION_MINUTES);
      })
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
      <div className="flex w-full max-w-md flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>Sign in did not finish</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/login">Try again</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner /> Signing you in…
    </div>
  );
}
