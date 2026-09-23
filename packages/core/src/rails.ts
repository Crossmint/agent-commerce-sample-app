import type { OrderIntent, OrderIntentRail, RailKind } from "./types.js";

/**
 * Agent Commerce's rail policy: a card network rail (Visa Intelligent Commerce, Mastercard Agent Pay)
 * first, the encrypted-card fallback second. The Stripe `spt` rail is never used or shown.
 */
export const DEFAULT_RAIL_PREFERENCE: RailKind[] = ["agentic-token", "encrypted-card"];

/** Rails Agent Commerce works with. Everything else is dropped before it reaches a UI or an agent. */
export function agentRails(orderIntent: Pick<OrderIntent, "rails">): OrderIntentRail[] {
  return orderIntent.rails.filter((r) => r.rail !== "spt");
}

/** Copy of an order intent with only the rails Agent Commerce works with. */
export function withAgentRails<T extends Pick<OrderIntent, "rails">>(orderIntent: T): T {
  return { ...orderIntent, rails: agentRails(orderIntent) };
}

export interface RailSelection {
  rail: OrderIntentRail;
  /** True when Crossmint enforces the amount for this rail. False for encrypted-card. */
  enforced: boolean;
}

/**
 * Pick the rail to mint from. Reads `rails[].status`, never the top-level status.
 * Returns null when no rail is usable right now.
 */
export function selectRail(
  orderIntent: Pick<OrderIntent, "rails">,
  preference: RailKind[] = DEFAULT_RAIL_PREFERENCE,
): RailSelection | null {
  for (const kind of preference) {
    const rail = orderIntent.rails.find((r) => r.rail === kind && r.status === "active");
    if (rail) return { rail, enforced: rail.rail !== "encrypted-card" };
  }
  return null;
}

/** Rails that still need the user to verify in a browser. */
export function pendingVerificationRails(
  orderIntent: Pick<OrderIntent, "rails">,
): OrderIntentRail[] {
  return agentRails(orderIntent).filter((r) => r.status === "pending_verification");
}

/**
 * Rails waiting on the security code of the saved card behind them.
 *
 * Crossmint keeps the CVC in its vault for a limited time. When that copy
 * lapses, the rail that needs it reports `pending_cvc_recollection` and mints
 * nothing until the user types the three digits again. Today only the
 * encrypted-card rail asks; the filter reads the status rather than the rail,
 * so another one asking later needs no change here.
 */
export function pendingCvcRecollectionRails(
  orderIntent: Pick<OrderIntent, "rails">,
): OrderIntentRail[] {
  return agentRails(orderIntent).filter((r) => r.status === "pending_cvc_recollection");
}

/**
 * Does the user have to type the security code before this card can pay?
 *
 * Only when nothing else on it will. Rails are tried in order, so a live
 * network rail pays without the encrypted-card fallback ever being reached: a
 * lapsed code behind a working rail costs nothing today and is not the user's
 * problem yet, so no surface asks about it. It becomes one the moment the
 * fallback is the rail the payment needs — which is where `selectRail` comes
 * back empty and the mint answers `cvc_recollection_required`.
 *
 * `pendingCvcRecollectionRails` is the raw read, for anyone who wants to know
 * a rail is stale whether or not it is in the way.
 */
export function needsCvcRecollection(orderIntent: Pick<OrderIntent, "rails">): boolean {
  return !hasCardRail(orderIntent) && pendingCvcRecollectionRails(orderIntent).length > 0;
}

export function hasUsableRail(orderIntent: Pick<OrderIntent, "rails">): boolean {
  return selectRail(orderIntent) !== null;
}

export function describeRail(rail: OrderIntentRail): string {
  switch (rail.rail) {
    case "agentic-token":
      return rail.provider === "vic" ? "Visa Intelligent Commerce" : "Mastercard Agent Pay";
    case "spt":
      return "Stripe shared payment token";
    case "encrypted-card":
      return "Encrypted card (limit not enforced by the network)";
  }
}

/** Rails that yield card details a merchant form accepts. */
export const CARD_RAILS: ReadonlySet<RailKind> = new Set(["agentic-token", "encrypted-card"]);

/** True when a rail that produces card details is active. */
export function hasCardRail(orderIntent: Pick<OrderIntent, "rails">): boolean {
  return orderIntent.rails.some((r) => CARD_RAILS.has(r.rail) && r.status === "active");
}

/** Is the agent card ready for an agent to pay with? Only a live card rail counts. */
export function isReadyForAgent(orderIntent: Pick<OrderIntent, "rails">): boolean {
  return hasCardRail(orderIntent);
}
