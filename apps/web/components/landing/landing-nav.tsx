import Image from "next/image";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";

/** Sticky top bar: the GOAT logo on the left, the two calls to action on the right. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="GOAT home">
          <Image src="/brand/logo.png" alt="GOAT" width={96} height={32} priority className="h-8 w-auto" />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <Button asChild size="sm" variant="outline">
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
