import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/checkout-screen";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutScreen checkoutId={id} />;
}
