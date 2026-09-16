"use client";

import { useEffect, useState } from "react";
import { useInView } from "./use-in-view";

/** Counts from 0 to `target` over `duration` ms. Jumps under reduced motion. */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (reduce) {
        setValue(target);
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const money = (v: number) => `$${v.toFixed(2)}`;
const minutes = (v: number) => `${Math.round(v)} min`;

/**
 * A slim stat strip: "2 min vs 10 min" and "$0.05 vs $1". Numbers count up and
 * the bars grow when the strip scrolls into view. No card around it.
 */
export function CostCompare() {
  const { ref, inView } = useInView<HTMLDivElement>({ once: true, threshold: 0.4 });
  const on = inView === true;
  const goatMin = useCountUp(on ? 2 : 0, 1000);
  const goatCost = useCountUp(on ? 0.05 : 0);

  return (
    <div ref={ref} className="grid gap-8 border-t border-border/70 pt-8 sm:grid-cols-2 sm:gap-12">
      <Stat label="Time to check out" value={minutes(goatMin)} vs="10 min for a typical agent" width={on ? "20%" : "0%"} />
      <Stat label="Tokens per checkout" value={money(goatCost)} vs="$1 for a typical agent" width={on ? "5%" : "0%"} />
    </div>
  );
}

function Stat({ label, value, vs, width }: { label: string; value: string; vs: string; width: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tracking-tight text-primary tabular-nums sm:text-5xl">{value}</span>
        <span className="text-sm text-muted-foreground sm:text-base">vs {vs}</span>
      </p>
      <div className="flex flex-col gap-1.5" aria-hidden>
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
          <div className="landing-bar h-full min-w-1.5 rounded-sm bg-primary" style={{ width }} />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
          <div className="landing-bar h-full rounded-sm bg-muted-foreground/50" style={{ width: width === "0%" ? "0%" : "100%" }} />
        </div>
      </div>
    </div>
  );
}
