"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprovalSheetBody } from "./agent-app-story";
import { AgentAppScreen, AppSheet, type AppEntry } from "./screen-agent-app";
import { useReducedMotion } from "./use-step-loop";

/*
 * One agent-app run, played inside a phone. The hero plays the whole story;
 * `how-it-works` plays the approval and the checkout on their own. All three
 * are the same component with a different script, so the design cannot drift
 * between them.
 *
 * Nothing swaps screens. Entries arrive one at a time into a thread that sits
 * on the composer and grows upward, and the approval rides up as a sheet over
 * that same thread, which is what the real app does with its `PhoneSheet`.
 * An entry at 0 is simply there from the start.
 */

export interface AppRunScript {
  /** Each entry and when it lands, ms from the start of the run. */
  thread: { at: number; entry: AppEntry }[];
  /**
   * The Approve sheet. Its contents are mounted for the whole run, so `ready`,
   * `press` and `approved` are on the run's clock, not the sheet's. Leave
   * `down` out for a sheet that stays up once it has risen.
   */
  sheet?: {
    up: number;
    down?: number;
    ready: number;
    press: number;
    approved: number;
  };
}

/**
 * A run restarts when `run` changes or reduced motion comes on. Both resets
 * happen during render, the React pattern for state derived from the previous
 * render: an effect that reset them synchronously would cascade a second
 * render on every tick.
 */
function useRunReset<T>(run: number, enabled: boolean, value: T, set: (v: T) => void) {
  const [prev, setPrev] = useState({ run, enabled });
  if (prev.run !== run || prev.enabled !== enabled) {
    setPrev({ run, enabled });
    set(value);
  }
}

/** How many entries have landed. Under reduced motion they are all there at once. */
function useLanded(landings: number[], run: number, enabled: boolean): number {
  const [n, setN] = useState(enabled ? 0 : landings.length);
  useRunReset(run, enabled, enabled ? 0 : landings.length, setN);
  useEffect(() => {
    if (!enabled) return;
    const ids = landings.map((at, i) =>
      window.setTimeout(() => setN((c) => Math.max(c, i + 1)), at),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
    // `landings` is a stable array from a module-level script.
  }, [run, enabled, landings]);
  return n;
}

/** True once the sheet has risen, and false again if the script brings it down. */
function useSheetWindow(sheet: AppRunScript["sheet"], run: number, enabled: boolean): boolean {
  const [open, setOpen] = useState(false);
  useRunReset(run, enabled, false, setOpen);
  useEffect(() => {
    if (!enabled || !sheet) return;
    const rise = window.setTimeout(() => setOpen(true), sheet.up);
    const fall =
      sheet.down === undefined ? undefined : window.setTimeout(() => setOpen(false), sheet.down);
    return () => {
      window.clearTimeout(rise);
      if (fall !== undefined) window.clearTimeout(fall);
    };
  }, [run, enabled, sheet]);
  return open;
}

/**
 * `run` restarts the script when it changes. A caller that remounts this
 * component instead (a `key`) can leave it out.
 */
export function AgentAppRun({ script, run = 0 }: { script: AppRunScript; run?: number }) {
  const reduce = useReducedMotion();
  const landings = useMemo(() => script.thread.map((t) => t.at), [script]);
  const landed = useLanded(landings, run, !reduce);
  const open = useSheetWindow(script.sheet, run, !reduce);
  const entries = useMemo(
    () => script.thread.slice(0, landed).map((t) => t.entry),
    [script, landed],
  );
  return (
    <div className="relative h-full">
      <AgentAppScreen entries={entries} />
      {script.sheet ? (
        <AppSheet open={open} title="Approve">
          {/*
            Keyed by the run: its steps are CSS delays that play once, from
            mount. Without a fresh mount each run, the second run's sheet
            would open on "Approved." with the request long gone.
          */}
          <ApprovalSheetBody
            key={run}
            ready={script.sheet.ready}
            press={script.sheet.press}
            approved={script.sheet.approved}
          />
        </AppSheet>
      ) : null}
    </div>
  );
}
