"use client";

import { cn } from "@/lib/cn";
import { BRAND_THEME_META, BRAND_THEMES, type BrandTheme } from "@/components/brand-themes";

/**
 * Picks one of the three example brands: a pill of tabs, each a swatch of
 * the brand's accent on its ground and the brand's name. Same shape as the
 * experience switcher, so the two read as one family of controls.
 */
export function BrandPicker({ value, onChange, className, size = "md" }: { value: BrandTheme; onChange: (brand: BrandTheme) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="tablist" aria-label="Brand" className={cn("flex items-center gap-1 rounded-full bg-card/70 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-lg", className)}>
      {BRAND_THEMES.map((id) => {
        const meta = BRAND_THEME_META[id];
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            title={meta.tagline}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-full font-medium tracking-tight whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "md" ? "h-9 px-3 text-sm sm:px-4" : "h-8 px-2.5 text-xs",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Swatch colors={meta.swatch} />
            <span className={cn(!active && size === "md" && "hidden sm:inline")}>{meta.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The brand's ground as a disc with its accent as a dot inside, ringed so a white ground still shows. */
export function Swatch({ colors, className }: { colors: readonly [string, string, string]; className?: string }) {
  const [ground, , accent] = colors;
  return (
    <span aria-hidden className={cn("relative inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10", className)} style={{ backgroundColor: ground }}>
      <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
    </span>
  );
}
