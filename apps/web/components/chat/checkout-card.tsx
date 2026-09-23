"use client";

import { useEffect, type ReactNode } from "react";
import type { CheckoutView } from "@agent-commerce/server";
import type { CheckoutOutcome, CheckoutUpdate } from "@/lib/chat/tools";
import { checkoutStatusLine, type ToolError, type WatchIndex } from "./parts";
import { ToolCard, type ToolState } from "./tool-card";
import { useCheckoutWatch } from "./use-checkout-watch";

/**
 * A pending `watch_checkout`, live: each update the store's agent writes
 * lands as its own message, drawn by `renderUpdate`, and `working` shows
 * while the run goes on. When the run needs the user or ends, the call hands
 * back and the model speaks next.
 */
export function LiveCheckoutUpdates({
  toolCallId,
  checkoutId,
  watches,
  onOutcome,
  renderUpdate,
  working,
}: {
  toolCallId: string;
  checkoutId: string;
  watches: WatchIndex;
  onOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  renderUpdate: (update: CheckoutUpdate) => ReactNode;
  working: ReactNode;
}) {
  const updates = useCheckoutWatch({ toolCallId, checkoutId, watches, onOutcome });
  return (
    <>
      {updates.map(renderUpdate)}
      {working}
    </>
  );
}

/**
 * The same watch with nothing on screen, for a frame that draws its thread
 * from plain data (the messaging frame builds bubbles). It lifts the updates
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
  onUpdates: (toolCallId: string, updates: CheckoutUpdate[]) => void;
}) {
  const updates = useCheckoutWatch({ toolCallId, checkoutId, watches, onOutcome });
  useEffect(() => onUpdates(toolCallId, updates), [onUpdates, toolCallId, updates]);
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
