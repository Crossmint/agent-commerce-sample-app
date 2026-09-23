"use client";

import * as React from "react";
import type { CheckoutMessage } from "@agent-commerce/core";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

/** Pages a transcript may take before the hook stops following the cursor. */
const MAX_PAGES = 5;

export interface UseCheckoutMessagesOptions {
  /** Poll while this is true, typically while the run is not terminal. Default true. */
  live?: boolean;
  /** Default 2000ms. */
  pollMs?: number;
}

/**
 * A checkout's transcript, oldest first: what the agent reported, what it
 * asked, what the user answered. Polls while `live`.
 */
export function useCheckoutMessages(
  checkoutId: string | undefined,
  { live = true, pollMs = 2000 }: UseCheckoutMessagesOptions = {},
): Resource<CheckoutMessage[]> {
  const { api } = useAgentCommerce();
  const liveRef = React.useRef(live);
  liveRef.current = live;

  const fetcher = React.useCallback(async () => {
    const out: CheckoutMessage[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const list = await api.listCheckoutMessages(checkoutId as string, { cursor, limit: 100 });
      out.push(...list.data);
      if (!list.nextCursor) break;
      cursor = list.nextCursor;
    }
    return out;
  }, [api, checkoutId]);

  const resource = useResource(fetcher, [checkoutId], {
    enabled: Boolean(checkoutId),
    pollMs,
    shouldPoll: () => liveRef.current,
  });

  // Read again whenever `live` flips: turning on starts the polling, and
  // turning off picks up the steps the run wrote as it ended.
  const { refetch } = resource;
  const wasLive = React.useRef(live);
  React.useEffect(() => {
    if (wasLive.current !== live) void refetch();
    wasLive.current = live;
  }, [live, refetch]);

  return resource;
}
