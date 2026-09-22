import { BatteryFull, Signal, Wifi } from "lucide-react";
import { cn } from "@/lib/cn";
import { Clock } from "./clock";

/**
 * The mock status bar at the top of the phone screen: the clock and the
 * signal, wifi and battery glyphs. Desktop only; on a phone the real one is
 * right above.
 */
export function PhoneStatusBar({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <div className={cn("hidden items-center justify-between px-8 pt-5 md:flex", tone === "light" ? "text-white" : "text-foreground", className)}>
      <Clock />
      <div className="flex items-center gap-1.5">
        <Signal className="size-[18px] fill-current" strokeWidth={1.5} />
        <Wifi className="size-[18px]" strokeWidth={2.5} />
        <BatteryFull className="size-6 fill-current" strokeWidth={1.5} />
      </div>
    </div>
  );
}
