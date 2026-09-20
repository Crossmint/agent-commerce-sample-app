import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { GoatLockup } from "@/components/brand";
import { GridCell } from "@/components/landing/grid";

/**
 * The ground every screen outside the wallet stands on: sign in, authorize an
 * agent, approve a budget, and the page that is not there. The landing's
 * dotted backdrop, the halftone bleeding in from the top right, and the
 * content in one cell of the hairline grid with a green diamond at each
 * corner. No nav — each of these is one decision, and the lockup at the top
 * of the cell is the only chrome it needs.
 *
 * Every screen is one column at the same width, so the grid does not move
 * from screen to screen and nothing turns into a second layout on a wide
 * display. `width="lg"` gives the approval screen a little more room on a
 * desktop, since it carries a list and a card picker rather than a field or
 * two. The wrapper is `overflow-hidden` because the cell's rules bleed past
 * it, and `--font-heading` hands the display face to components from
 * @goat-wallet/ui, which ask for it by that name.
 */
export function FocusScreen({
  width = "md",
  footer,
  children,
}: {
  /** "md" is the form width. "lg" is a step wider, from `lg` up. */
  width?: "md" | "lg";
  /** Its own row under a full-bleed rule at the foot, as on the landing. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className="goat-backdrop relative flex flex-1 flex-col overflow-hidden [--font-heading:var(--font-display)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-16 h-[300px] w-[420px] bg-[url(/brand/agents/texture-halftone-green.png)] bg-cover bg-right-top opacity-30 [mask-image:linear-gradient(to_bottom_left,#000_20%,transparent_72%)] sm:-right-24 sm:h-[460px] sm:w-[640px]"
      />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className={cn("relative w-full max-w-md", width === "lg" && "lg:max-w-xl")}>
          {/* The verticals stop on the cell's own rules: run past, they would
              carry on down through anything at the foot. */}
          <GridCell bleed={false} />
          <div className="flex flex-col gap-7 px-6 py-10 sm:px-9 sm:py-12">
            <Link href="/" aria-label="GOAT home" className="self-start">
              <GoatLockup size="md" />
            </Link>
            {children}
          </div>
        </div>
      </div>
      {footer}
    </main>
  );
}
