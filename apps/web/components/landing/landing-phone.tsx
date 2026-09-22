import type { CSSProperties, ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * The landing phone: the onramp sample app's DeviceFrame at a width that
 * fits a two-column section. A light grey bezel with a thin border, 56px
 * outer corners and 42px screen corners at full size, a white screen. Every
 * measure is a share of `--phone-w` (set in landing.css), so one token sizes
 * every phone on the page. The onramp frame is 426x886 with a 393x852
 * screen; the shares below keep those proportions.
 */

const FRAME_W = 426;
const BEZEL = 15;
const BORDER = 2;
const OUTER_R = 56;
const SCREEN_R = 42;

const share = (px: number) => `calc(var(--phone-w, 320px) * ${px / FRAME_W})`;

export interface LandingPhoneProps {
  children: ReactNode;
  className?: string;
  /** Accessible description of what the phone shows. The frame is one picture to assistive tech. */
  label?: string;
}

export function LandingPhone({ children, className, label }: LandingPhoneProps) {
  const frame = {
    width: "var(--phone-w, 320px)",
    padding: share(BEZEL),
    borderWidth: BORDER,
    borderRadius: share(OUTER_R),
  } as CSSProperties;
  const screen = { borderRadius: share(SCREEN_R) } as CSSProperties;
  const button = "absolute hidden w-1.5 rounded-[3px] border-2 border-device-frame-border bg-device-button sm:block";

  return (
    <div role={label ? "img" : undefined} aria-label={label} className={cn("relative shrink-0", className)} style={{ width: "var(--phone-w, 320px)" }}>
      <div aria-hidden className={cn(button, "left-[-3px]")} style={{ top: share(228), height: share(36) }} />
      <div aria-hidden className={cn(button, "left-[-3px]")} style={{ top: share(279), height: share(36) }} />
      <div aria-hidden className={cn(button, "left-[-3px]")} style={{ top: share(329), height: share(36) }} />
      <div aria-hidden className={cn(button, "right-[-3px]")} style={{ top: share(223), height: share(58) }} />
      <div
        className="relative z-1 border-device-frame-border bg-device-frame shadow-[0_120px_73px_rgba(0,0,0,0.03),0_54px_54px_rgba(0,0,0,0.05),0_8px_16px_rgba(0,0,0,0.06)]"
        style={frame}
      >
        <div className="relative flex aspect-[393/852] w-full flex-col overflow-hidden bg-background text-foreground" style={screen}>
          <StatusBar />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The mock status bar over the top of the screen: 9:41 and the glyphs. Screens pad under it. */
function StatusBar() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between px-6 text-[13px] font-semibold text-foreground">
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1">
        <Signal className="size-[14px] fill-current" strokeWidth={1.5} />
        <Wifi className="size-[14px]" strokeWidth={2.5} />
        <BatteryFull className="size-[18px] fill-current" strokeWidth={1.5} />
      </span>
    </div>
  );
}

/** The home indicator at the foot of a screen. */
export function HomeIndicator({ className }: { className?: string }) {
  return <span aria-hidden className={cn("pointer-events-none absolute bottom-1.5 left-1/2 z-20 h-1 w-[34%] -translate-x-1/2 rounded-full bg-foreground/60", className)} />;
}
