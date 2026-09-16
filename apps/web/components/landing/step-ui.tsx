"use client";

import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Stacks screens inside one phone. The active one is visible; the others
 * crossfade out with a small slide toward the side they sit on.
 */
export function ScreenStack({ active, children }: { active: number; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div className="relative h-full">
      {items.map((child, i) => (
        <div
          key={i}
          aria-hidden={i !== active}
          data-state={i === active ? "active" : i < active ? "before" : "after"}
          className="landing-screen-layer absolute inset-0"
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/** Small dots under a single phone. Clicking a dot jumps to that step. */
export function StepDots({ count, active, onPick, labels }: { count: number; active: number; onPick: (i: number) => void; labels: string[] }) {
  return (
    <div role="tablist" aria-label="Steps" className="-ml-2 flex items-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={labels[i]}
          onClick={() => onPick(i)}
          className="flex size-6 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span
            className={cn(
              "block h-1.5 rounded-sm transition-all duration-300",
              i === active ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
