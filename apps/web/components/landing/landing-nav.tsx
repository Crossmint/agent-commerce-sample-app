import Image from "next/image";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { GITHUB_URL } from "./links";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#build", label: "For developers" },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="GOAT home">
          <Image src="/brand/logo.png" alt="GOAT" width={96} height={32} priority className="h-8 w-auto" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {links.map((l) =>
            l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/wallet">Open wallet</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
