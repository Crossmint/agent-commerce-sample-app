"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckoutMessage } from "@agent-commerce/core";
import {
  CHECKOUT_FALLBACK_POLL_MS,
  checkoutChanged,
  isTerminalCheckoutView,
  useCheckout,
  useCheckoutMessages,
} from "@agent-commerce/ui";
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
 * One pending `watch_checkout` call, run on the client. Follows the
 * checkout's event stream with no time limit, and returns the updates the store's
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
}: CheckoutWatchOptions): { updates: CheckoutUpdate[]; startedAt: string } {
  // When this stretch started, for the card's clock. A reload mid-run starts it again.
  const [startedAt] = useState(() => new Date().toISOString());
  // The stream says when the run moves; the checkout is read then, and only
  // now and again besides, in case the stream went quiet.
  const checkout = useCheckout(checkoutId, { pollMs: CHECKOUT_FALLBACK_POLL_MS });
  const reported = useRef(false);
  const { refetch: readCheckout } = checkout;
  const feed = useCheckoutMessages(checkoutId, {
    // Nothing more comes once the run has ended.
    live: !isTerminalCheckoutView(checkout.data),
    onEvent: (event) => {
      if (checkoutChanged(event)) void readCheckout();
    },
  });
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
      onOutcome(toolCallId, {
        ...stop,
        updates: fresh(messages ?? [], shown),
        startedAt,
        endedAt: new Date().toISOString(),
      }),
    );
  }, [checkout.data, watches.asked, shown, refetch, onOutcome, toolCallId, startedAt]);

  return { updates, startedAt };
}

function fresh(messages: CheckoutMessage[], shown: ReadonlySet<string> | undefined) {
  return feedUpdates(messages).filter((u) => !shown?.has(u.id));
}
