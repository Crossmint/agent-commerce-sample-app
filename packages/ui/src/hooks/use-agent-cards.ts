"use client";

import * as React from "react";
import type { AgentCard } from "@agent-commerce/core";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

export interface UseAgentCardsResult extends Resource<AgentCard[]> {
  revoke: (agentCardId: string) => Promise<void>;
}

export function useAgentCards({ enabled = true }: { enabled?: boolean } = {}): UseAgentCardsResult {
  const { api } = useAgentCommerce();
  const fetcher = React.useCallback(() => api.listAgentCards(), [api]);
  const resource = useResource(fetcher, [], { enabled });

  const revoke = React.useCallback(
    async (agentCardId: string) => {
      await api.revokeAgentCard(agentCardId);
      resource.setData((prev) =>
        prev?.map((c) => (c.orderIntentId === agentCardId ? { ...c, status: "cancelled" as const } : c)),
      );
    },
    [api, resource],
  );

  return { ...resource, revoke };
}
