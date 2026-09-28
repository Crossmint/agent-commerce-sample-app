"use client";

import * as React from "react";
import type { PaymentMethod } from "@agent-commerce/core";
import { useAgentCommerce } from "../provider.js";
import { useResource, type Resource } from "./use-resource.js";

export interface UsePaymentMethodsResult extends Resource<PaymentMethod[]> {
  remove: (paymentMethodId: string) => Promise<void>;
}

export function usePaymentMethods({ enabled = true }: { enabled?: boolean } = {}): UsePaymentMethodsResult {
  const { api } = useAgentCommerce();
  const fetcher = React.useCallback(() => api.listPaymentMethods(), [api]);
  const resource = useResource(fetcher, [], { enabled });

  const remove = React.useCallback(
    async (paymentMethodId: string) => {
      await api.deletePaymentMethod(paymentMethodId);
      resource.setData((prev) => prev?.filter((pm) => pm.paymentMethodId !== paymentMethodId));
    },
    [api, resource],
  );

  return { ...resource, remove };
}
