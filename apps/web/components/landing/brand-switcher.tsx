"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApproveScreenMock } from "./approve-screen-mock";
import { BRANDS, type BrandId } from "./brands";
import { MessageThreadMock } from "./message-thread-mock";

/**
 * Three fictional brands, one flow. Each brand has its own approval layout and
 * its own theme tokens. All three panels stay mounted in one grid cell and
 * crossfade, so switching never shifts the page.
 */
export function BrandSwitcher() {
  const [active, setActive] = useState<BrandId>("goat");
  // Bumps each time the brand changes so the active thread replays.
  const [switches, setSwitches] = useState(0);

  const pick = (id: BrandId) => {
    if (id === active) return;
    setActive(id);
    setSwitches((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Brand" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-border bg-background p-1">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={b.id === active}
            onClick={() => pick(b.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              b.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="grid">
        {BRANDS.map((b) => {
          const on = b.id === active;
          return (
            <div
              key={b.id}
              data-brand={b.id}
              data-active={on}
              aria-hidden={!on}
              style={b.vars}
              className="landing-xfade landing-theme goat-backdrop rounded-[calc(var(--radius)+1rem)] border border-border bg-background p-3 text-foreground sm:p-8"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading, inherit)" }}>
                    {b.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{b.blurb}</p>
                </div>
                <div className="grid items-start justify-items-center gap-8 sm:grid-cols-2">
                  <ApproveScreenMock brand={b} className="w-full" />
                  <MessageThreadMock key={on ? switches : -1} style={b.threadStyle} variant="request" domain={b.domain} className="w-full" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
