import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { MaskLogo } from "./mask-logo";

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
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com", w: 2048, h: 407 },
];

const HEIGHT = 24;

/**
 * How many times the logos repeat in the track. The loop needs the visible
 * strip to be no wider than `(COPIES - 1)` copies, or it runs out of logos
 * before it wraps; four covers a strip up to three times the logo run, which
 * is well past the widest container here.
 */
const COPIES = [0, 1, 2, 3];

/**
 * The label sits above the logo strip, which slides without stopping at every
 * width. The caller sets how wide it is. The second pass of the logos is
 * decorative:
 * it repeats what the first already said, so it is hidden from screen readers
 * and taken out of the tab order.
 *
 * Spacing lives on the items as trailing padding, not as a `gap` on the
 * track — see `.goat-marquee` in globals.css for why the loop depends on it.
 */
export function PoweredBy({ inset = true, className }: { inset?: boolean; className?: string }) {
  return (
    <section aria-label="Powered by" className={cn("flex w-full flex-col gap-4", className)}>
      {/* The indent keeps the label off a grid rule on the container's own
          edge. In a band with padding of its own it would sit further in than
          everything above it, so that caller turns it off. The strip below
          keeps the full width; its masked edges soften where it meets the
          rule. */}
      <p
        className={cn(
          "shrink-0 text-xs font-medium tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase",
          inset && "pl-4 sm:pl-6",
        )}
      >
        Powered by
      </p>
      <div className="goat-marquee">
        <ul className="goat-marquee-track" style={{ "--goat-marquee-copies": COPIES.length } as CSSProperties}>
          {COPIES.flatMap((copy) =>
            LOGOS.map((logo) => (
              <li key={`${copy}-${logo.name}`} className="shrink-0 pr-12" aria-hidden={copy > 0 || undefined}>
                <a
                  href={logo.href}
                  target="_blank"
                  rel="noreferrer"
                  title={logo.name}
                  tabIndex={copy > 0 ? -1 : undefined}
                  className="inline-flex h-6 items-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MaskLogo src={logo.src} label={copy === 0 ? logo.name : ""} width={Math.round((HEIGHT * logo.w) / logo.h)} height={HEIGHT} />
                </a>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}
