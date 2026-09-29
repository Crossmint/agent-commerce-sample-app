/**
 * How the user pays for a product on a Shopify store, chosen before the
 * checkout starts. Plain data and arithmetic, so the tool schema on the
 * server and the choice in the chat share one source.
 *
 * - agent_card: an agent card the user already has, active, with enough left
 *   and not locked to another store. The checkout starts with it, and nobody
 *   approves anything again.
 * - card: a new agent card is approved first, and the checkout starts with it.
 *   Its payment step is answered from that card with no question.
 * - shop_pay: the store's agent pays with Shop Pay. The user signs in to
 *   their Shop account when the store asks.
 * - other: any other way the store takes, in the user's words.
 */
export const PAYMENT_CHOICE_METHODS = ["agent_card", "card", "shop_pay", "other"] as const;
export type PaymentChoiceMethod = (typeof PAYMENT_CHOICE_METHODS)[number];

export interface Money {
  value: string;
  currency: string;
}

/**
 * The most a purchase may cost when the store only states the total at its
 * payment step: the price, with room for shipping and tax. A quarter more,
 * at least 10 more, rounded up to a whole amount. It is a limit, not a
 * charge: the store charges its real total.
 */
export function budgetFor(price: { amount: string; currency: string }): Money | undefined {
  const amount = Number.parseFloat(price.amount);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const value = Math.ceil(amount + Math.max(amount * 0.25, 10));
  return { value: value.toFixed(2), currency: price.currency.toUpperCase() };
}

/** "35.99 USD", as the catalog writes a price, as an amount and a currency. */
export function parsePrice(text: string | undefined): { amount: string; currency: string } | undefined {
  const match = text?.trim().match(/^(\d+(?:\.\d{1,2})?)\s+([A-Za-z]{3})$/);
  return match ? { amount: match[1]!, currency: match[2]!.toUpperCase() } : undefined;
}
