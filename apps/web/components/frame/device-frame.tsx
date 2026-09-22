"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

// Desktop iPhone frame, scaled via --device-scale (see globals.css).
const FRAME_H = 886;
const MARGIN = 40;
// Must match the 2xl breakpoint in frame-page.tsx.
const STACKED_FOOTER_BREAKPOINT = 1536;
// Room for the centered footer below the phone.
const STACKED_FOOTER_MARGIN = 96;

/**
 * The phone: a 426x886 iPhone frame on a desktop, scaled to fit the viewport
 * height, and the bare screen filling the viewport on a phone. Children are
 * the screen. Pair it with `PhoneStatusBar` for the clock and glyphs.
 */
export function DeviceFrame({ children, className, reserveTop = 0 }: { children: React.ReactNode; className?: string; /** Pixels kept clear above the phone on a desktop, for a bar fixed at the top of the page. */ reserveTop?: number }) {
  useEffect(() => {
    const apply = () => {
      const margin = (window.innerWidth >= STACKED_FOOTER_BREAKPOINT ? STACKED_FOOTER_MARGIN : MARGIN) + reserveTop;
      const scale = Math.max(0.35, Math.min(1, (window.innerHeight - margin) / FRAME_H));
      document.documentElement.style.setProperty("--device-scale", String(scale));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [reserveTop]);

  const button = "absolute hidden w-2 rounded-[3px] border-2 border-device-frame-border bg-device-button md:block";

  return (
    <div className={cn("device-frame relative flex min-h-0 w-full flex-col md:w-[426px] md:animate-in md:duration-700 md:ease-out md:zoom-in-95 md:fade-in", className)} style={reserveTop ? ({ "--reserve-top": `${reserveTop}px` } as React.CSSProperties) : undefined}>
      <div className="device-frame-inner relative min-h-0 w-full flex-1 md:h-[886px] md:w-[426px] md:flex-none">
        <div className={cn(button, "top-[228px] left-[-4px] h-[36px]")} />
        <div className={cn(button, "top-[279px] left-[-4px] h-[36px]")} />
        <div className={cn(button, "top-[329px] left-[-4px] h-[36px]")} />
        <div className={cn(button, "top-[223px] right-[-4px] h-[58px]")} />

        <div className="relative z-1 h-full w-full md:rounded-[56px] md:border-2 md:border-device-frame-border md:bg-device-frame md:shadow-[0_120px_73px_rgba(0,0,0,0.03),0_54px_54px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)]">
          <div className="h-full w-full overflow-hidden bg-background md:absolute md:top-[15px] md:left-[15px] md:h-[852px] md:w-[393px] md:rounded-[42px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
