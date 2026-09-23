"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CheckoutMessage } from "@agent-commerce/core";
import { useCheckout, useCheckoutMessages } from "@agent-commerce/ui";
import type { CheckoutOutcome, CheckoutUpdate } from "@/lib/chat/tools";
import { feedUpdates, stopReason, type WatchIndex } from "./parts";

export interface CheckoutWatchOptions {
  toolCallId: string;
  checkoutId: string;
  /** What earlier watches in the thread already did. */
  watches: WatchIndex;
  onOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
}

/**
 * One pending `watch_checkout` call, run on the client. Polls the checkout
 * and its transcript with no time limit, and returns the updates the store's
 * agent wrote since the last watch, for the chat to post as messages. When
 * the store asks a question, the run reaches its payment step, or it ends,
 * reads the transcript once more and hands everything back as the tool
 * output. The model takes it from there.
 */
export function useCheckoutWatch({
  toolCallId,
  checkoutId,
  watches,
  onOutcome,
}: CheckoutWatchOptions): CheckoutUpdate[] {
  const checkout = useCheckout(checkoutId);
  const reported = useRef(false);
  const feed = useCheckoutMessages(checkoutId);
  const shown = watches.shown.get(checkoutId);

  const updates = useMemo(() => fresh(feed.data ?? [], shown), [feed.data, shown]);

  const { refetch } = feed;
  useEffect(() => {
    if (reported.current || !checkout.data) return;
    const stop = stopReason(checkout.data, watches.asked);
    if (!stop) return;
    reported.current = true;
    // The run moved first; the transcript may be a poll behind. Read it again
    // so the hand-back carries every update up to this point.
    void refetch().then((messages) =>
      onOutcome(toolCallId, { ...stop, updates: fresh(messages ?? [], shown) }),
    );
  }, [checkout.data, watches.asked, shown, refetch, onOutcome, toolCallId]);

  return updates;
}

function fresh(messages: CheckoutMessage[], shown: ReadonlySet<string> | undefined) {
  return feedUpdates(messages).filter((u) => !shown?.has(u.id));
}
