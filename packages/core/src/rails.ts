import type { OrderIntent, OrderIntentRail, RailKind } from "./types.js";

export const DEFAULT_RAIL_PREFERENCE: RailKind[] = ["agentic-token", "spt", "encrypted-card"];

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
  return orderIntent.rails.filter((r) => r.status === "pending_verification");
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
