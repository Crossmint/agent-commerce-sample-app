"use client";

import { useEffect, type ReactNode } from "react";
import type { CheckoutView } from "@agent-commerce/server";
import type { CheckoutOutcome, CheckoutUpdate } from "@/lib/chat/tools";
import { CheckoutRunCard } from "./checkout-site";
import {
  checkoutStatusLine,
  runSteps,
  stoppedForUser,
  type CheckoutSite,
  type ToolError,
  type WatchIndex,
} from "./parts";
import { ToolCard, type ToolState } from "./tool-card";
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
 * after the answer, gets a card of its own below it.
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
  const site = watches.sites.get(checkoutId) ?? { host: "the store" };
  const shape = {
    host: site.host,
    continuing: watches.firstWatch.get(checkoutId) !== toolCallId,
  };
  const title = runTitle(site, shape.continuing);
  if (output) {
    const steps = runSteps({
      ...shape,
      updates: output.updates ?? [],
      live: false,
      outcome: output,
    });
    return (
      <CheckoutRunCard
        site={site}
        title={title}
        steps={steps}
        startedAt={output.startedAt}
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
          steps={runSteps({ ...shape, updates, live: true })}
          startedAt={startedAt}
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

/**
 * A checkout tool call that no watch covers: one that failed before it had a
 * checkout, or a `get_checkout` on a run from another conversation. One line
 * of status.
 */
export function CheckoutCard({
  title,
  state,
  input,
  checkout,
  errorText,
}: {
  title: string;
  state: ToolState;
  input?: unknown;
  checkout?: CheckoutView | ToolError;
  errorText?: string;
}) {
  const failed = checkout && "error" in checkout ? checkout : undefined;
  const view = checkout && !("error" in checkout) ? checkout : undefined;
  return (
    <ToolCard
      title={title}
      state={state}
      input={input}
      output={checkout}
      errorText={errorText ?? failed?.error}
      summary={view ? checkoutStatusLine(view) : undefined}
    />
  );
}
