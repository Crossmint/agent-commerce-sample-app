"use client";

import { useEffect, useState, type ReactNode } from "react";
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
 * "2 min vs 10 min" and "$0.05 vs $1" as bars that grow in when scrolled into
 * view. Numbers count up with them.
 */
export function CostCompare() {
  const { ref, inView } = useInView<HTMLDivElement>({ once: true, threshold: 0.4 });
  const on = inView === true;
  const goatMin = useCountUp(on ? 2 : 0, 1000);
  const typicalMin = useCountUp(on ? 10 : 0, 1000);
  const goatCost = useCountUp(on ? 0.05 : 0);
  const typicalCost = useCountUp(on ? 1 : 0);

  return (
    <div ref={ref} className="flex flex-col gap-5 rounded-2xl border border-border bg-background/60 p-4">
      <Group label="Time to check out">
        <Row label="GOAT" value={minutes(goatMin)} width={on ? "20%" : "0%"} accent />
        <Row label="Typical agent" value={minutes(typicalMin)} width={on ? "100%" : "0%"} />
      </Group>
      <Group label="Tokens per checkout">
        <Row label="GOAT" value={money(goatCost)} width={on ? "6%" : "0%"} accent />
        <Row label="Typical agent" value={money(typicalCost)} width={on ? "100%" : "0%"} />
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, value, width, accent = false }: { label: string; value: string; width: string; accent?: boolean }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
      <span className={accent ? "text-xs font-semibold" : "text-xs font-medium text-muted-foreground"}>{label}</span>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={accent ? "landing-bar h-full min-w-2.5 rounded-full bg-primary" : "landing-bar h-full rounded-full bg-muted-foreground/50"}
          style={{ width }}
        />
      </div>
      <span className={accent ? "min-w-[3.5rem] text-right text-base font-bold tabular-nums text-primary" : "min-w-[3.5rem] text-right text-base font-bold tabular-nums text-muted-foreground"}>
        {value}
      </span>
    </div>
  );
}
