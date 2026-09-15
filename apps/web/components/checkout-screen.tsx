"use client";

import { CheckoutView } from "@goat-wallet/ui";

export function CheckoutScreen({ checkoutId }: { checkoutId: string }) {
  return <CheckoutView checkoutId={checkoutId} className="mx-auto w-full max-w-3xl" />;
}
