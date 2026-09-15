"use client";

import * as React from "react";
import type { CheckoutView } from "../api/types.js";
import { useGoat } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

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
  /** Answer a pending user action. Replaces the local view with the server's response. */
  submitAction: (actionId: string, values: Record<string, unknown>) => Promise<CheckoutView>;
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

  const submitAction = React.useCallback(
    async (actionId: string, values: Record<string, unknown>) => {
      setSubmitting(true);
      try {
        const next = await api.submitCheckoutAction(checkoutId as string, actionId, values);
        resource.setData(next);
        return next;
      } finally {
        setSubmitting(false);
      }
    },
    [api, checkoutId, resource],
  );

  return { ...resource, submitAction, submitting };
}
