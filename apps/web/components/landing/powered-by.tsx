import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { MaskLogo } from "./mask-logo";

/**
 * The rails and infrastructure under the sample app. Full logotypes at one
 * height, in the page's muted text color: the files fill with `currentColor`
 * and render as masks, so they follow the theme. `w` and `h` are each file's
 * intrinsic size, for the aspect ratio.
 */
const LOGOS: Array<{ name: string; src: string; href: string; w: number; h: number }> = [
  { name: "Crossmint", src: "/logos/crossmint-gray.svg", href: "https://www.crossmint.com", w: 127, h: 24 },
  { name: "Visa", src: "/logos/visa.svg", href: "https://usa.visa.com", w: 58, h: 19 },
  { name: "Mastercard", src: "/logos/mastercard.svg", href: "https://www.mastercard.com", w: 42, h: 26 },
  { name: "Basis Theory", src: "/logos/basis-theory.svg", href: "https://basistheory.com", w: 87, h: 30 },
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com", w: 2048, h: 407 },
];

const HEIGHT = 22;

/**
 * How many times the logos repeat in the track. The loop needs the visible
 * strip to be no wider than `(COPIES - 1)` copies, or it runs out of logos
 * before it wraps; four covers a strip up to three times the logo run.
 */
const COPIES = [0, 1, 2, 3];

/**
 * The label, then the logo strip sliding without a stop. The copies after
 * the first repeat what it already said, so they are hidden from screen
 * readers and out of the tab order. Spacing rides on the items as trailing
 * padding, not as a `gap` on the track: see `.ac-marquee` in globals.css.
 */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <section aria-label="Powered by" className={cn("flex w-full flex-col items-start gap-4", className)}>
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Powered by</p>
      <div className="ac-marquee w-full">
        <ul className="ac-marquee-track" style={{ "--ac-marquee-copies": COPIES.length } as CSSProperties}>
          {COPIES.flatMap((copy) =>
            LOGOS.map((logo) => (
              <li key={`${copy}-${logo.name}`} className="shrink-0 pr-14" aria-hidden={copy > 0 || undefined}>
                <a
                  href={logo.href}
                  target="_blank"
                  rel="noreferrer"
                  title={logo.name}
                  tabIndex={copy > 0 ? -1 : undefined}
                  className="inline-flex h-6 items-center text-muted-foreground/70 transition-colors hover:text-foreground"
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
