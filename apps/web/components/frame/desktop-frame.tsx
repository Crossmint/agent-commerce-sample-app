"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

// A 1120x720 window, scaled via --desktop-scale (see globals.css).
const FRAME_W = 1120;
const FRAME_H = 720;
const MARGIN_X = 96;
const MARGIN_Y = 160;

/**
 * A desktop app window, for the experiences that live on a laptop rather than
 * a phone: a title bar with the three traffic lights and an address pill,
 * then the screen. Scaled to fit the viewport on a desktop; on a phone it is
 * the bare screen, like `DeviceFrame`.
 */
export function DesktopFrame({ children, address, className }: { children: React.ReactNode; address?: string; className?: string }) {
  useEffect(() => {
    const apply = () => {
      const scale = Math.max(0.35, Math.min(1, (window.innerWidth - MARGIN_X) / FRAME_W, (window.innerHeight - MARGIN_Y) / FRAME_H));
      document.documentElement.style.setProperty("--desktop-scale", String(scale));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div className={cn("desktop-frame relative flex min-h-0 w-full flex-col md:animate-in md:duration-700 md:ease-out md:zoom-in-95 md:fade-in", className)}>
      <div className="desktop-frame-inner relative flex min-h-0 w-full flex-1 flex-col md:h-[720px] md:w-[1120px] md:flex-none">
        <div className="flex h-full w-full flex-col overflow-hidden bg-background md:rounded-2xl md:border md:border-device-frame-border/60 md:shadow-[0_120px_73px_rgba(0,0,0,0.03),0_54px_54px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)]">
          {/* Title bar, desktop only. */}
          <div className="hidden h-11 shrink-0 items-center gap-3 border-b border-border bg-device-frame px-4 md:flex">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            {address ? (
              <div className="mx-auto flex h-7 w-full max-w-md items-center justify-center rounded-lg bg-background/80 px-3 text-xs text-muted-foreground ring-1 ring-foreground/5">
                {address}
              </div>
            ) : null}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
