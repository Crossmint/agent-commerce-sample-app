import type { CSSProperties } from "react";
import { Button } from "@goat-wallet/ui";
import { GoatLockup } from "@/components/brand";
import { AnchorLink } from "./anchor-link";
import { GridCell } from "./grid";
import { PoweredBy } from "./powered-by";
import { HeroPhone } from "./hero-phone";

const rise = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/**
 * The hero: one grid cell on the dotted ground, opening flush under the nav
 * — no band above it. Halftone green bleeds in
 * from the top right, the blue pixel block sits in the bottom left corner,
 * and the headline and the phone share the cell. The powered-by strip has
 * the band under the cell to itself — the row between the cell's bottom rule
 * and the rule that opens the next section, which was otherwise empty. Its
 * padding matches the cell's, so the label starts on the same line as the
 * lockup and the headline.
 */
export function Hero() {
  return (
    <section className="goat-backdrop relative overflow-hidden">
      {/* Textures. Behind everything, clipped by the section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-16 h-[380px] w-[520px] bg-[url(/brand/agents/texture-halftone-green.png)] bg-cover bg-right-top opacity-35 [mask-image:linear-gradient(to_bottom_left,#000_20%,transparent_72%)] sm:-right-24 sm:h-[620px] sm:w-[880px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[96px] w-[134px] bg-[url(/brand/agents/texture-pixels-blue.png)] bg-cover opacity-90 sm:h-[144px] sm:w-[200px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="relative">
          {/* Open at the top: the nav's own border is the line there. On a
              phone the verticals go too, so the phone below can have the
              width they and their padding were taking. */}
          <GridCell top={false} sides="sm" />
          <div className="grid items-center gap-14 pt-12 pb-8 sm:px-10 sm:pt-16 sm:pb-10 lg:grid-cols-[1.3fr_1fr] lg:gap-10 lg:pt-20">
            <div className="flex flex-col items-start gap-6">
              <div className="flex flex-col items-start gap-3 sm:gap-4">
                {/* The nav already carries the lockup, and on a phone the
                    two sit a thumb apart. */}
                <GoatLockup size="lg" className="landing-rise hidden sm:inline-flex" />
                {/* From `sm` up both lines are held unbroken, so the size is
                    capped by the column: 56px fits the narrow lg column, 64px
                    the full one. A phone is narrower than either line, so
                    there the words wrap instead of running off the screen. */}
                <h1 className="landing-rise font-display text-[2.75rem]/[1.02] font-semibold tracking-[-0.035em] text-foreground sm:text-[3.5rem]/[1.02] min-[1152px]:text-[4rem]/[1]" style={rise(60)}>
                  <span className="sm:whitespace-nowrap">An open alternative</span> <span className="sm:whitespace-nowrap">to Stripe Link</span>
                </h1>
              </div>
              <p className="landing-rise max-w-xl text-lg leading-snug text-muted-foreground sm:text-xl" style={rise(110)}>
                Give your agents a card and check out at millions of merchants using this simple template. Your brand, your users.
              </p>
              <div className="landing-rise flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row" style={rise(220)}>
                <Button asChild size="lg">
                  <AnchorLink href="#try">Try it live</AnchorLink>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <AnchorLink href="#build">Build your own</AnchorLink>
                </Button>
              </div>
            </div>

            {/* The phone sets the cell's height, and the cell has to leave the
                strip below it on the first screen. A short desktop gets a
                narrower phone; a tall one keeps the full size. A phone is
                short too, but it scrolls, so the rule stays off it. This overrides
                the `--phone-w` token rather than the frame's max-width,
                because landing.css derives the frame's height from the token
                — capping the width alone would squash the phone. */}
            <HeroPhone className="landing-rise relative mx-auto w-full max-w-[var(--phone-w)] [@media(max-height:860px)_and_(min-width:640px)]:[--phone-w:230px] lg:mr-0" />
          </div>
        </div>

        {/* The band below the cell. The cell's own bottom rule closes the
            hero above it and the section's rule closes it below, so the strip
            needs no line of its own. */}
        <div className="relative py-6 sm:px-10">
          <PoweredBy inset={false} />
        </div>
      </div>
    </section>
  );
}
