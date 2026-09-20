import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { GoatLockup } from "@/components/brand";
import { AnchorLink } from "./anchor-link";
import { GITHUB_URL, X_URL } from "./links";
import { GitHubMark, XMark } from "./social-marks";

/**
 * Sticky top bar: the Crossmint Agents lockup with GOAT on the left; GitHub,
 * X, and the two calls to action on the right. Under 640px only "Try it live"
 * stays on the right, so the bar fits a 375px phone; the footer repeats the
 * GitHub and X links and the hero repeats "Build your own".
 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="GOAT home">
          <GoatLockup size="sm" />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GOAT on GitHub"
            className="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            <GitHubMark className="size-5" />
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Crossmint on X"
            className="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            <XMark className="size-4" />
          </a>
          <Button asChild size="sm" className="justify-center sm:min-w-[8.5rem]">
            <AnchorLink href="#try">Try it live</AnchorLink>
          </Button>
          <Button asChild size="sm" variant="outline" className="hidden justify-center sm:inline-flex sm:min-w-[8.5rem]">
            <AnchorLink href="#build">Build your own</AnchorLink>
          </Button>
        </nav>
      </div>
    </header>
  );
}
