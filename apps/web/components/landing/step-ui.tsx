"use client";

import { Children, type ReactNode, useState } from "react";

/**
 * Stacks screens inside one phone. The active one is visible; the others
 * crossfade out with a small slide toward the side they sit on.
 */
export function ScreenStack({ active, children }: { active: number; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div className="relative h-full">
      {items.map((child, i) => (
        <div key={i} aria-hidden={i !== active} data-state={i === active ? "active" : i < active ? "before" : "after"} className="landing-screen-layer absolute inset-0">
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * A key per screen that changes when that screen becomes active, and never
 * when it leaves, so each screen's CSS timeline restarts from zero as it
 * comes in. Screen 0 also changes with the loop counter, so the story
 * restarts when the phone scrolls back into view. Uses the React pattern
 * for state derived from the previous render.
 */
export function useActivationKeys(step: number, cycle: number, count: number): string[] {
  const [keys, setKeys] = useState<number[]>(() => Array.from({ length: count }, () => 0));
  const [prev, setPrev] = useState({ step, cycle });
  if (prev.step !== step || prev.cycle !== cycle) {
    setPrev({ step, cycle });
    setKeys((k) => k.map((n, i) => (i === step ? n + 1 : n)));
  }
  return keys.map((n, i) => (i === 0 ? `${cycle}-${n}` : `${n}`));
}
