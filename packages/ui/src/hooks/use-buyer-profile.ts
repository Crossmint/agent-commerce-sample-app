"use client";

import * as React from "react";
import type { BuyerProfile } from "@agent-commerce/core";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

/** The user's saved buyer details (name, contact, shipping), or null when there are none. */
export function useBuyerProfile(): Resource<BuyerProfile | null> {
  const { api } = useAgentCommerce();
  const fetcher = React.useCallback(() => api.getBuyerProfile(), [api]);
  return useResource(fetcher, []);
}
