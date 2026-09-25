"use client";

import { useEffect, type ReactNode } from "react";
import type { CheckoutOutcome, CheckoutUpdate } from "@/lib/chat/tools";
import { CheckoutRunCard } from "./checkout-site";
import { runSteps, stoppedForUser, type CheckoutSite, type WatchIndex } from "./parts";
import { useCheckoutWatch } from "./use-checkout-watch";

/** What a live watch has so far: the store agent's updates, and when the stretch began. */
export interface LiveWatch {
  updates: CheckoutUpdate[];
  startedAt: string;
}

/**
 * One `watch_checkout` call as a card of steps. Live while the call runs,
 * from its output after. Each call is one stretch of the checkout: when the
 * store asks something, the agent asks in the thread, and the next stretch,
 * after the answer, gets a card of its own below it. When the agent answered
 * the question itself, with nothing shown in between, the next stretch takes
 * this card over instead: one card, the earlier steps first.
 */
export function WatchRun({
  toolCallId,
  checkoutId,
  watches,
  output,
  onOutcome,
  compact,
  className,
}: {
  toolCallId: string;
  checkoutId: string;
  watches: WatchIndex;
  output?: CheckoutOutcome;
  onOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  compact?: boolean;
  className?: string;
}) {
  // The next stretch took this card over.
  if (watches.absorbed.has(toolCallId)) return null;
  const carried = watches.carried.get(toolCallId);
  const site = watches.sites.get(checkoutId) ?? { host: "the store" };
  const shape = {
    host: site.host,
    continuing: watches.firstWatch.get(checkoutId) !== (carried?.chainStart ?? toolCallId),
  };
  const title = runTitle(site, shape.continuing);
  const before = carried?.updates ?? [];
  if (output) {
    const steps = runSteps({
      ...shape,
      updates: [...before, ...(output.updates ?? [])],
      live: false,
      outcome: output,
    });
    return (
      <CheckoutRunCard
        site={site}
        title={title}
        steps={steps}
        startedAt={carried?.startedAt ?? output.startedAt}
        endedAt={output.endedAt ?? output.startedAt}
        folded={stoppedForUser(output) ? "title" : "latest"}
        compact={compact}
        className={className}
      />
    );
  }
  return (
    <LiveRun
      toolCallId={toolCallId}
      checkoutId={checkoutId}
      watches={watches}
      onOutcome={onOutcome}
      render={({ updates, startedAt }) => (
        <CheckoutRunCard
          site={site}
          title={title}
          steps={runSteps({ ...shape, updates: [...before, ...updates], live: true })}
          startedAt={carried?.startedAt ?? startedAt}
          compact={compact}
          className={className}
        />
      )}
    />
  );
}

function LiveRun({
  toolCallId,
  checkoutId,
  watches,
  onOutcome,
  render,
}: {
  toolCallId: string;
  checkoutId: string;
  watches: WatchIndex;
  onOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  render: (watch: LiveWatch) => ReactNode;
}) {
  const watch = useCheckoutWatch({ toolCallId, checkoutId, watches, onOutcome });
  return <>{render(watch)}</>;
}

/** A stretch's title: the task at the start, "Continuing checkout" after an answer. */
export function runTitle(site: CheckoutSite, continuing: boolean): string {
  if (continuing) return "Continuing checkout";
  return site.action ?? `Checking out on ${site.host}`;
}

/**
 * The same watch with nothing on screen, for a frame that draws its thread
 * from plain data (the messaging frame builds bubbles). It lifts what it has
 * out through `onUpdates` and hands back like the live one.
 */
export function CheckoutWatcher({
  toolCallId,
  checkoutId,
  watches,
  onOutcome,
  onUpdates,
}: {
  toolCallId: string;
  checkoutId: string;
  watches: WatchIndex;
  onOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  onUpdates: (toolCallId: string, watch: LiveWatch) => void;
}) {
  const { updates, startedAt } = useCheckoutWatch({ toolCallId, checkoutId, watches, onOutcome });
  useEffect(
    () => onUpdates(toolCallId, { updates, startedAt }),
    [onUpdates, toolCallId, updates, startedAt],
  );
  return null;
}
