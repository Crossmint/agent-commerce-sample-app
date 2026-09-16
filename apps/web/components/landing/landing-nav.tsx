import Image from "next/image";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { GITHUB_URL, X_URL } from "./links";
import { GitHubMark, XMark } from "./social-marks";

/** Sticky top bar: the GOAT logo on the left; GitHub, X, and the two calls to action on the right. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="GOAT home">
          <Image src="/brand/logo.png" alt="GOAT" width={96} height={32} priority className="h-8 w-auto" />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GOAT on GitHub"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <GitHubMark className="size-5" />
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Crossmint on X"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XMark className="size-4" />
          </a>
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="#try">Try it live</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="#build">Build your own</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
