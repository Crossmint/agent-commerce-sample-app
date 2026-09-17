"use client";

import * as React from "react";
import type { CheckoutView } from "../api/types.js";
import { useGoat } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

const TERMINAL = new Set(["succeeded", "blocked", "failed", "cancelled"]);

export function isTerminalCheckoutView(view: CheckoutView | undefined): boolean {
  return Boolean(view && TERMINAL.has(view.status));
}

export interface UseCheckoutOptions {
  /** Poll while the checkout is not terminal. Default true. */
  poll?: boolean;
  /** Default 1500ms while running, 4000ms while a user action is open. */
  pollMs?: number;
}

export interface UseCheckoutResult extends Resource<CheckoutView> {
  /** Submit form values for the open request. Replaces the local view with the server's response. */
  submitAction: (requestId: string, values: Record<string, unknown>) => Promise<CheckoutView>;
  /** Refuse the open request. */
  decline: (requestId: string) => Promise<CheckoutView>;
  /** Stop the checkout. It reaches `cancelled` on a later poll. */
  cancel: () => Promise<CheckoutView>;
  submitting: boolean;
}

export function useCheckout(checkoutId: string | undefined, { poll = true, pollMs }: UseCheckoutOptions = {}): UseCheckoutResult {
  const { api } = useGoat();
  const fetcher = React.useCallback(() => api.getCheckout(checkoutId as string), [api, checkoutId]);
  const [submitting, setSubmitting] = React.useState(false);

  const resource = useResource(fetcher, [checkoutId], {
    enabled: Boolean(checkoutId),
    pollMs: poll ? (pollMs ?? 1500) : undefined,
    shouldPoll: (view) => !isTerminalCheckoutView(view),
  });

  const send = React.useCallback(
    async (run: () => Promise<CheckoutView>) => {
      setSubmitting(true);
      try {
        const next = await run();
        resource.setData(next);
        return next;
      } finally {
        setSubmitting(false);
      }
    },
    [resource],
  );

  const submitAction = React.useCallback(
    (requestId: string, values: Record<string, unknown>) => send(() => api.answerCheckout(checkoutId as string, { requestId, action: "submit", values })),
    [api, checkoutId, send],
  );
  const decline = React.useCallback(
    (requestId: string) => send(() => api.answerCheckout(checkoutId as string, { requestId, action: "decline" })),
    [api, checkoutId, send],
  );
  const cancel = React.useCallback(() => send(() => api.cancelCheckout(checkoutId as string)), [api, checkoutId, send]);

  return { ...resource, submitAction, decline, cancel, submitting };
}
