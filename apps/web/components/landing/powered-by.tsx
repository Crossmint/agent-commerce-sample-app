import { cn } from "@/lib/cn";
import { GridCell, GridNode } from "./grid";
import { MaskLogo } from "./mask-logo";
import { Container } from "./section";

/**
 * The rails and infrastructure under GOAT. Full logotypes at one height, in
 * the page's muted text color: the files fill with `currentColor` and render
 * as masks, so they follow the theme. `w` and `h` are each file's intrinsic
 * size, for the aspect ratio.
 */
const LOGOS: Array<{ name: string; src: string; href: string; w: number; h: number }> = [
  { name: "Crossmint", src: "/logos/crossmint-gray.svg", href: "https://www.crossmint.com", w: 127, h: 24 },
  { name: "Visa", src: "/logos/visa.svg", href: "https://usa.visa.com", w: 58, h: 19 },
  { name: "Mastercard", src: "/logos/mastercard.svg", href: "https://www.mastercard.com", w: 42, h: 26 },
  { name: "Basis Theory", src: "/logos/basis-theory.svg", href: "https://basistheory.com", w: 87, h: 30 },
  { name: "Adyen", src: "/logos/adyen.svg", href: "https://www.adyen.com", w: 80, h: 26 },
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com", w: 2048, h: 407 },
];

const HEIGHT = 24;
const COLS = 2;
const LABEL = "text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase";

export function PoweredBy() {
  return (
    <section aria-label="Powered by" className="relative overflow-hidden">
      {/* Phones: one cell of the page's own grid. The rules bleed to the
          viewport edges, the verticals run the height of the section, and a
          green diamond marks every crossing — the same motif as the hero, so
          the block reads as part of the page and not as a panel on top of it. */}
      <Container className="py-2 sm:hidden">
        <div className="goat-backdrop relative">
          <GridCell bleed={false} />
          <p className={cn("relative px-4 py-3.5", LABEL)}>Powered by</p>
          <ul className="relative grid grid-cols-2 border-t border-hairline">
            {LOGOS.map((logo, i) => (
              <li
                key={logo.name}
                className={cn("relative flex h-20 items-center justify-center", i % COLS < COLS - 1 && "border-r border-hairline", i >= COLS && "border-t border-hairline")}
              >
                <GridNode className="absolute top-0 left-0 z-10 -translate-x-1/2 -translate-y-1/2" />
                {i % COLS === COLS - 1 ? <GridNode className="absolute top-0 right-0 z-10 translate-x-1/2 -translate-y-1/2" /> : null}
                <Logo logo={logo} />
              </li>
            ))}
          </ul>
          {/* The centre vertical ends on the cell's bottom rule. */}
          <GridNode className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />
        </div>
      </Container>

      {/* sm and up: one row, label first. */}
      <Container className="hidden py-8 sm:flex sm:flex-row sm:items-center sm:gap-10">
        <p className={cn("shrink-0", LABEL)}>Powered by</p>
        <ul className="flex flex-wrap items-center gap-x-12 gap-y-5">
          {LOGOS.map((logo) => (
            <li key={logo.name} className="flex h-6 items-center">
              <Logo logo={logo} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Logo({ logo }: { logo: (typeof LOGOS)[number] }) {
  return (
    <a
      href={logo.href}
      target="_blank"
      rel="noreferrer"
      title={logo.name}
      className="inline-flex h-6 items-center text-muted-foreground transition-colors hover:text-foreground"
    >
      <MaskLogo src={logo.src} label={logo.name} width={Math.round((HEIGHT * logo.w) / logo.h)} height={HEIGHT} />
    </a>
  );
}
