import type { OrderIntentRail, PaymentMethod, RegistrationRail } from "@agent-commerce/core";
import { describeRail, formatAmount } from "@agent-commerce/core";

export { formatAmount };

/** "Visa" from "visa", "Mastercard" from "mastercard", "Amex" from "amex". */
export function cardBrandLabel(brand: string | undefined): string {
  if (!brand) return "Card";
  const b = brand.toLowerCase();
  const known: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    master: "Mastercard",
    amex: "Amex",
    "american-express": "Amex",
    american_express: "Amex",
    discover: "Discover",
    diners: "Diners",
    jcb: "JCB",
    unionpay: "UnionPay",
    maestro: "Maestro",
  };
  return known[b] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

/** "Visa •••• 4242" */
export function paymentMethodLabel(pm: PaymentMethod): string {
  if (pm.card) return `${cardBrandLabel(pm.card.brand)} •••• ${pm.card.last4}`;
  return pm.displayName ?? pm.paymentMethodId;
}

/** Short date for expiry lines: "Sep 16, 2026, 3:04 PM". */
export function formatDateTime(iso: string | undefined, locale = "en-US"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Date only: "Sep 16, 2026". */
export function formatDate(iso: string | undefined, locale = "en-US"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * How far off a moment is, in words: "in 3 days", "in 5 hours", "2 days ago".
 * The unit is the largest one that still leaves a number at or above one, so a
 * budget that lapses next week reads in days rather than in 160 hours.
 *
 * `now` is a parameter so a caller can pin it — the default reads the clock,
 * which would differ between a server render and the client one.
 */
export function formatRelativeTime(iso: string | undefined, locale = "en-US", now = Date.now()): string {
  if (!iso) return "";
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return iso;
  const diff = at - now;
  const size = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (size < MINUTE) return rtf.format(Math.round(diff / 1000), "second");
  if (size < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (size < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (size < WEEK) return rtf.format(Math.round(diff / DAY), "day");
  if (size < MONTH) return rtf.format(Math.round(diff / WEEK), "week");
  if (size < YEAR) return rtf.format(Math.round(diff / MONTH), "month");
  return rtf.format(Math.round(diff / YEAR), "year");
}

/** Short label for a rail badge: "Visa IC", "Mastercard Agent Pay", "Stripe SPT", "Encrypted card". */
export function railShortLabel(rail: Pick<OrderIntentRail, "rail"> & { provider?: string }): string {
  switch (rail.rail) {
    case "agentic-token":
      return rail.provider === "vic" ? "Visa IC" : rail.provider === "agentpay" ? "Mastercard Agent Pay" : "Network token";
    case "spt":
      return "Stripe SPT";
    case "encrypted-card":
      return "Encrypted card";
    default:
      return String(rail.rail);
  }
}

/** Long label for a rail, from core when the shape allows it. */
export function railLongLabel(rail: OrderIntentRail): string {
  return describeRail(rail);
}

/** Registration rails come back from register with a slightly different shape. */
export function registrationRailLabel(rail: RegistrationRail): string {
  return railShortLabel({ rail: rail.rail as OrderIntentRail["rail"], provider: rail.provider });
}
