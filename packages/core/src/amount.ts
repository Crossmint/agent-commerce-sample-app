/** Format a decimal string amount for humans: "25.00" + "USD" → "$25.00". */
export function formatAmount(value: string | number, currency: string, locale = "en-US"): string {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(n)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/**
 * Where `Intl`'s display digits differ from ISO 4217 minor units. Amounts
 * here feed payment rails and minor-unit prices, so the ISO count is the
 * one that matters: COP displays with no decimals but its minor unit is the
 * centavo, so 5,000,000 minor units is 50,000.00, not 5,000,000.
 */
const ISO_MINOR_UNITS: Record<string, number> = {
  COP: 2,
  HUF: 2,
  IDR: 2,
  PKR: 2,
  TWD: 2,
  MGA: 2,
  MRU: 2,
  IQD: 3,
};

/**
 * The decimals a currency allows: 2 for USD, 0 for CLP or JPY, 3 for KWD.
 * Throws on a code `Intl` does not know, so a typo fails loudly here rather
 * than as a rejected payment downstream. `fallback` returns instead of
 * throwing, for display paths that should degrade to the common shape.
 */
export function currencyFractionDigits(currency: string, fallback?: number): number {
  const code = currency.toUpperCase();
  const unknown = (): number => {
    if (fallback !== undefined) return fallback;
    throw new Error(`Unknown currency: ${currency}`);
  };
  // NumberFormat only checks the code's shape: "ZZZ" formats without
  // throwing, so membership has to come from the ISO list itself.
  if (SUPPORTED_CURRENCIES !== null && !SUPPORTED_CURRENCIES.has(code)) {
    return unknown();
  }
  if (code in ISO_MINOR_UNITS) return ISO_MINOR_UNITS[code]!;
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
    if (digits === undefined) return unknown();
    return digits;
  } catch {
    return unknown();
  }
}

const SUPPORTED_CURRENCIES =
  typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;

/** Fraction digits that carry a value — trailing zeros don't count: "1.250" → 2, "10000.00" → 0. */
export function significantDecimals(value: string): number {
  const frac = value.split(".")[1] ?? "";
  return frac.replace(/0+$/, "").length;
}

/**
 * Normalize user input like "50", "50.5", "$50" into Crossmint's decimal
 * string, with exactly the decimals the currency allows: "10000" for CLP,
 * "25.00" for USD, "1.250" for KWD. An input that needs more decimals than
 * the currency has — "10000.5" in CLP — throws rather than silently rounding.
 */
export function toDecimalString(input: string | number, currency: string): string {
  const cleaned = typeof input === "number" ? String(input) : input.replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${input}`);
  const digits = currencyFractionDigits(currency);
  const rounded = Number(n.toFixed(digits));
  const excess =
    typeof input === "string"
      ? // A written-out amount states its decimals exactly; trailing zeros
        // don't count, any other digit past the currency's does.
        significantDecimals(cleaned) > digits
      : // A number only carries float dust (0.1 + 0.2); compare within a few
        // ulps so real fractions throw at any magnitude.
        Math.abs(n - rounded) > Number.EPSILON * Math.max(1, Math.abs(n)) * 8;
  if (excess) {
    throw new Error(`Invalid amount: ${input} has more decimals than ${currency} allows`);
  }
  return rounded.toFixed(digits);
}

/** ISO timestamp `hours` from now, for `expiresAt`. */
export function expiresInHours(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}
