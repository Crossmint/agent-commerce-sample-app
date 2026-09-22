import Link from "next/link";
import { Button } from "@agent-commerce/ui";
import { CrossmintLogo } from "@/components/brand";
import { SiteHeader } from "@/components/frame/site-header";
import { AnchorLink } from "./anchor-link";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#experiences", label: "Experiences" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Sticky top bar: the logo card on the left, the section links and "Try it
 * live" on the right. Under 640px the card shrinks to the logo alone and the
 * links go, so the bar fits a 375px phone.
 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 bg-app-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="hidden sm:block">
          <SiteHeader animate={false} />
        </div>
        <Link href="/" aria-label="Agent Commerce Sample App home" className="flex h-[52px] items-center rounded-[10px] border border-border bg-background/80 px-3.5 backdrop-blur sm:hidden">
          <CrossmintLogo height={20} />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <AnchorLink key={l.href} href={l.href} className="hidden h-9 items-center rounded-full px-3.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex">
              {l.label}
            </AnchorLink>
          ))}
          <Button asChild size="lg" className="ml-1 sm:min-w-[7.5rem]">
            <Link href="/app">Try it live</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
