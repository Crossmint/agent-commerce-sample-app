"use client";

import { CheckoutView } from "@agent-commerce/ui";

/** The checkout view, centered in the window the page gives it. */
export function CheckoutScreen({ checkoutId }: { checkoutId: string }) {
  return <CheckoutView checkoutId={checkoutId} className="mx-auto w-full max-w-3xl" />;
}
