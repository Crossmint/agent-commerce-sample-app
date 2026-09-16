"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "./use-in-view";

/** True when the OS asks for reduced motion. False until measured. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}

export interface StepLoopOptions {
  /** ms per step. Default 2500. */
  interval?: number;
  /** Extra ms to hold the last step before the loop restarts. Default 0. */
  hold?: number;
  /** How much of the element must be visible to run. Default 0.3. */
  threshold?: number;
}

/**
 * Steps 0..count-1 on a timer while the element is in view, then loops.
 * `cycle` goes up on each loop, so callers can key replayed pieces on it.
 * The loop pauses out of view and restarts from step 0 on re-entry. Under
 * reduced motion the step rests on the last one and nothing moves.
 *
 * With `count = 1` the hook is a plain loop timer: `cycle` ticks every
 * `interval` ms while in view.
 */
export function useStepLoop<T extends Element>(count: number, { interval = 2500, hold = 0, threshold = 0.3 }: StepLoopOptions = {}) {
  const { ref, inView } = useInView<T>({ threshold });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const wasOut = useRef(false);

  useEffect(() => {
    if (inView === false) wasOut.current = true;
    if (inView === true && wasOut.current) {
      wasOut.current = false;
      setStep(0);
      setCycle((c) => c + 1);
    }
  }, [inView]);

  useEffect(() => {
    if (reduce || inView !== true) return;
    const last = step >= count - 1;
    const id = window.setTimeout(
      () => {
        if (last) {
          setStep(0);
          setCycle((c) => c + 1);
        } else {
          setStep(step + 1);
        }
      },
      last ? interval + hold : interval,
    );
    return () => window.clearTimeout(id);
  }, [step, cycle, inView, reduce, count, interval, hold]);

  return { ref, step: reduce ? count - 1 : step, cycle, jump: setStep, reduce };
}
