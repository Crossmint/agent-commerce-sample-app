"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApproveScreenMock } from "./approve-screen-mock";
import { BRANDS, DEFAULT_BRAND, type BrandId } from "./brands";
import { GoatAvatar, InitialAvatar, MessageThreadMock } from "./message-thread-mock";

/**
 * Three fictional brands, one flow. Each brand is a set of CSS variables on a
 * wrapper. The approval preview and the thread read those tokens, so nothing
 * inside them knows which brand is active.
 */
export function BrandSwitcher() {
  const [active, setActive] = useState<BrandId>("goat");
  const brand = BRANDS.find((b) => b.id === active) ?? DEFAULT_BRAND;

  return (
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label="Brand" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-border bg-card p-1">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={b.id === active}
            onClick={() => setActive(b.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              b.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div
        data-brand={brand.id}
        style={brand.vars}
        className="landing-theme goat-backdrop rounded-[calc(var(--radius)+1rem)] border border-border bg-background p-5 text-foreground sm:p-10"
      >
        <div key={brand.id} className="landing-fade flex flex-col gap-8">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <p
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              {brand.name}
            </p>
            <p className="text-sm text-muted-foreground">{brand.blurb}</p>
          </div>
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <ApproveScreenMock agentName={brand.agentName} />
            <MessageThreadMock
              agentName={brand.agentName}
              agentAvatar={brand.id === "goat" ? <GoatAvatar size={40} /> : <InitialAvatar letter={brand.name[0] ?? "?"} size={40} />}
              className="lg:justify-self-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
