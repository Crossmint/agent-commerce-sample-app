import type { ReactNode } from "react";
import { Skeleton } from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";
import { cn } from "@/lib/cn";

/**
 * The card the MCP and CLI experiences stand on. Not a device: one white
 * panel in the middle of the canvas, the heading at the top, then the steps.
 * It scrolls inside itself when the viewport is short.
 */
export function Panel({ title, sub, children, className }: { title: string; sub: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex max-h-[calc(100dvh-8rem)] w-full max-w-xl flex-col gap-8 overflow-y-auto rounded-2xl md:mt-16 bg-card p-6 ring-1 ring-foreground/10 animate-in fade-in zoom-in-95 duration-300 sm:p-8", className)}>
      <ScreenHeading title={title} sub={sub} />
      {children}
    </div>
  );
}

/** One numbered step: the number in a grey disc, the sentence, and whatever the step needs. */
export function Step({ n, children, aside }: { n: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{n}</span>
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
