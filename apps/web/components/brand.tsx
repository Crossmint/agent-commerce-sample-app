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

/** The Crossmint logotype in the current text color. `height` in px; the file is 127x24. */
export function CrossmintLogo({ height = 14, label = "Crossmint", className }: { height?: number; label?: string; className?: string }) {
  return <MaskLogo src="/logos/crossmint-gray.svg" label={label} width={Math.round((height * 127) / 24)} height={height} className={className} />;
}

export type WordmarkTone = "green" | "navy";

/**
 * "GOAT" in the pixel font (VCR OSD Mono), the same type as the Figma
 * "AGENTS" lockup. Green on light grounds; navy inside green areas. Size it
 * with a text class on `className`.
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
  /** "sm" for the nav bars, "md" for the footer and the wallet pages. */
  size?: "sm" | "md";
  className?: string;
}

/** The lockup: GOAT in the pixel font, then "by" and the Crossmint logotype in small. */
export function GoatLockup({ size = "sm", className }: GoatLockupProps) {
  const sm = size === "sm";
  return (
    <span className={cn("inline-flex items-baseline", sm ? "gap-2" : "gap-2.5", className)} aria-label="GOAT by Crossmint">
      <GoatWordmark className={sm ? "text-[22px]" : "text-[30px]"} />
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", sm ? "text-[11px]" : "text-[13px]")} aria-hidden>
        by
        <CrossmintLogo height={sm ? 12 : 15} label="" className="text-foreground" />
      </span>
    </span>
  );
}
