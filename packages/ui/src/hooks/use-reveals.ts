"use client";

import * as React from "react";
import type { Reveal } from "../api/types.js";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

export interface UseRevealsOptions {
  enabled?: boolean;
  /** The server's cap, not a page: the list is short by nature and there is no cursor. */
  limit?: number;
  /** Narrow to one budget, for its detail panel. */
  agentCardId?: string;
}

/**
 * Credentials this user's agents minted, newest first — the transactions list,
 * or one budget's slice of it.
 */
export function useReveals({ enabled = true, limit, agentCardId }: UseRevealsOptions = {}): Resource<Reveal[]> {
  const { api } = useAgentCommerce();
  const fetcher = React.useCallback(() => api.listReveals({ limit, agentCardId }), [api, limit, agentCardId]);
  return useResource(fetcher, [limit, agentCardId], { enabled });
}
