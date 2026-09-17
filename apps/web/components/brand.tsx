import Image from "next/image";
import { cn } from "@/lib/cn";
import { MaskLogo } from "@/components/landing/mask-logo";

/*
 * The GOAT identity, shared by the landing page and the wallet pages. GOAT
 * is a Crossmint product: the pixel wordmark leads, "by" and the Crossmint
 * logotype follow in small.
 */

/** The four-leaf Crossmint Agents mark, gradient fill. `size` in px. */
export function AgentsMark({ size = 22, className }: { size?: number; className?: string }) {
  return <Image src="/brand/agents/crossmint-agents-mark.svg" alt="" width={size} height={size} priority className={cn("shrink-0", className)} style={{ width: size, height: size }} />;
}

/**
 * The Crossmint logotype in the current text color. `height` in px; the file
 * is 127x24. The width is left fractional so `mask-size: contain` fits the
 * file exactly and the logotype's baseline stays on the box's bottom edge.
 */
export function CrossmintLogo({ height = 14, label = "Crossmint", className }: { height?: number; label?: string; className?: string }) {
  return <MaskLogo src="/logos/crossmint-gray.svg" label={label} width={(height * 127) / 24} height={height} className={className} />;
}

export type WordmarkTone = "green" | "navy";

/*
 * Two nudges put the lockup on one baseline. Both are whole pixels per size,
 * measured from the raster rather than the font metrics, so the pixel glyphs
 * and the masked logotype stay crisp.
 *
 * `lift`: VCR OSD Mono draws its glyphs clear of the baseline — the ink stops
 * about 0.049em above it — so the wordmark floats above anything set beside
 * it until it is pushed back down.
 *
 * `drop`: in crossmint-gray.svg the four-leaf mark fills all 24 units of
 * height while the logotype's baseline is at 18.2, because the mark
 * overshoots the type top and bottom. Sitting the box on the baseline hangs
 * the logotype 5.8/24 of its height too high.
 */

/**
 * "GOAT" in the pixel font (VCR OSD Mono), the same type as the Figma
 * "AGENTS" lockup. Green on light grounds; navy inside green areas. Size it
 * with a text class on `className` — include the line height (`text-[32px]/none`),
 * because a bare `text-[32px]` drops `leading-none` in the class merge.
 */
export function GoatWordmark({ tone = "green", className, label = "GOAT" }: { tone?: WordmarkTone; className?: string; label?: string }) {
  return (
    <span
      aria-label={label}
      className={cn("font-pixel leading-none tracking-[-0.01em] uppercase select-none", tone === "green" ? "text-brand-wordmark" : "text-foreground", className)}
    >
      GOAT
    </span>
  );
}

export interface GoatLockupProps {
  /** "sm" for the nav bars, "md" for the footer and the wallet pages, "lg" for the hero. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/* The pixel glyphs run to the edge of their advance width, so `gap` is the
 * whole visual gap after the wordmark: keep it near 0.12em of the word. */
const LOCKUP = {
  sm: { gap: "gap-[3px]", word: "text-[26px]/none", lift: "translate-y-px", by: "text-[12px]/none", logo: 13, drop: "translate-y-[3px]" },
  md: { gap: "gap-1", word: "text-[32px]/none", lift: "translate-y-[2px]", by: "text-[13px]/none", logo: 15, drop: "translate-y-[4px]" },
  lg: { gap: "gap-[5px] sm:gap-1.5", word: "text-[40px]/none sm:text-[48px]/none", lift: "translate-y-[2px]", by: "text-sm/none sm:text-base/none", logo: 17, drop: "translate-y-[4px]" },
} as const;

/**
 * The lockup: GOAT in the pixel font, then "by" and the Crossmint logotype in
 * small. Everything sits on one baseline — the wordmark's ink bottom, the "by"
 * baseline, and the crossmint logotype's own baseline.
 */
export function GoatLockup({ size = "sm", className }: GoatLockupProps) {
  const t = LOCKUP[size];
  return (
    <span className={cn("inline-flex items-baseline", t.gap, className)} aria-label="GOAT by Crossmint">
      <GoatWordmark className={cn(t.word, t.lift)} />
      <span className={cn("inline-flex items-baseline gap-1.5 text-muted-foreground", t.by)} aria-hidden>
        by
        <CrossmintLogo height={t.logo} label="" className={cn("text-foreground", t.drop)} />
      </span>
    </span>
  );
}
