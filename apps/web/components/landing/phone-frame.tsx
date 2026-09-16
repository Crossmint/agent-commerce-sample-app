import type { CSSProperties, ReactNode } from "react";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  /** Screen background, visible behind the status bar and under short content. */
  screenClassName?: string;
  /** Status bar and home indicator color. "light" is white glyphs for dark screens. */
  statusTone?: "light" | "dark";
  /** Frame width in CSS px at full size. The frame shrinks with its container. Default 300. */
  width?: number;
  /** Accessible description of the screen. The frame is one picture to assistive tech. */
  label?: string;
}

/**
 * A phone silhouette: 9:19.5 body, thin bezel, dynamic island, status bar and
 * home indicator. Children fill the screen. The status bar overlays the top
 * 44px, so screens draw their own header with `pt-11` to sit under it.
 */
export function PhoneFrame({ children, className, screenClassName, statusTone = "light", width = 300, label }: PhoneFrameProps) {
  const light = statusTone === "light";
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("landing-phone relative mx-auto w-full max-w-[var(--phone-w)] shrink-0", className)}
      style={{ "--phone-w": `${width}px` } as CSSProperties}
    >
      <div className={cn("landing-phone-screen", screenClassName)}>
        <StatusBar light={light} />
        <div aria-hidden className="landing-phone-island" />
        <div className="landing-phone-content">{children}</div>
        <div aria-hidden className={cn("landing-phone-home", light ? "bg-white/75" : "bg-black/60")} />
      </div>
    </div>
  );
}

function StatusBar({ light }: { light: boolean }) {
  return (
    <div aria-hidden className={cn("landing-phone-status", light ? "text-white" : "text-black")}>
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 18 12" width="17" height="11" fill="currentColor" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <Wifi className="size-3.5" strokeWidth={2.5} />
        <span className="relative ml-0.5 inline-flex h-[11px] w-[24px] items-center rounded-[3.5px] border-[1.5px] border-current p-[1.5px]">
          <span className="h-full w-full rounded-[1.5px] bg-current" />
          <span className="absolute top-1/2 -right-[3.5px] h-[4px] w-[1.5px] -translate-y-1/2 rounded-r-sm bg-current opacity-60" />
        </span>
      </span>
    </div>
  );
}
