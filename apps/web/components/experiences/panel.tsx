import type { ReactNode } from "react";
import { Skeleton } from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";
import { cn } from "@/lib/cn";

/**
 * What the MCP and CLI experiences stand on: the heading at the top, then the
 * steps. It scrolls inside itself when the viewport is short.
 *
 * On a desktop it is a card in the middle of the canvas. On a phone there is
 * no canvas worth showing around it, so it fills the screen with no ring, no
 * corners and no gutter, and reads as a page of the site rather than a card
 * floating on a dot grid.
 */
export function Panel({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-8 overflow-y-auto bg-background p-6 animate-in fade-in duration-300 sm:p-8",
        "md:mt-16 md:max-h-[calc(100dvh-8rem)] md:max-w-xl md:flex-none md:rounded-2xl md:bg-card md:ring-1 md:ring-foreground/10 md:zoom-in-95",
        className,
      )}
    >
      <ScreenHeading title={title} sub={sub} />
      {children}
    </div>
  );
}

/** One numbered step: the number in a grey disc, the sentence, and whatever the step needs. */
export function Step({
  n,
  children,
  aside,
}: {
  n: number;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
        <p className="text-sm leading-relaxed text-foreground">{children}</p>
        {aside}
      </div>
    </li>
  );
}

/** Holds the space of a copy chip while the origin is still unknown. */
export function ChipSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}
