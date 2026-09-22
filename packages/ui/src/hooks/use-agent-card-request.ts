"use client";

import * as React from "react";
import type { AgentCardRequest } from "../api/types.js";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

export interface UseAgentCardRequestOptions {
  /** Poll interval while the request is `pending` or `approved`. Default 2000ms. 0 disables polling. */
  pollMs?: number;
}

/** True while the agent is still waiting for an answer or verification. */
export function isOpenRequest(req: AgentCardRequest | undefined): boolean {
  return req?.status === "pending" || req?.status === "approved";
}

/** True once the user has a time limit to answer and it has passed. */
export function isRequestPastDeadline(req: AgentCardRequest | undefined, now = Date.now()): boolean {
  if (!req) return false;
  return req.status === "pending" && new Date(req.requestExpiresAt).getTime() < now;
}

export function useAgentCardRequest(
  requestId: string | undefined,
  { pollMs = 2000 }: UseAgentCardRequestOptions = {},
): Resource<AgentCardRequest> {
  const { api } = useAgentCommerce();
  const fetcher = React.useCallback(() => api.getAgentCardRequest(requestId as string), [api, requestId]);
  return useResource(fetcher, [requestId], {
    enabled: Boolean(requestId),
    pollMs: pollMs || undefined,
    shouldPoll: isOpenRequest,
  });
}
