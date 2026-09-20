import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { FocusScreen } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Not found" };

/**
 * Every unmatched URL, on the same ground as sign in and approval. Two ways
 * on: the wallet for someone signed in, the landing for everyone else.
 */
export default function NotFound() {
  return (
    <FocusScreen>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col items-start gap-2">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">
            This page is not here.
          </h1>
          <p className="max-w-prose text-muted-foreground">
            The link may be old, or the request it pointed at may be gone. Nothing was charged.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href="/wallet">Go to your wallet</Link>
          </Button>
          <Button asChild variant="link" size="sm" className="self-center">
            <Link href="/">Back to the home page</Link>
          </Button>
        </div>
      </div>
    </FocusScreen>
  );
}
