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
 * The decimals a currency allows: 2 for USD, 0 for CLP or JPY, 3 for KWD.
 * Throws on a code `Intl` does not know, so a typo fails loudly here rather
 * than as a rejected payment downstream.
 */
export function currencyFractionDigits(currency: string): number {
  const code = currency.toUpperCase();
  // NumberFormat only checks the code's shape: "ZZZ" formats without
  // throwing, so membership has to come from the ISO list itself.
  if (SUPPORTED_CURRENCIES !== null && !SUPPORTED_CURRENCIES.has(code)) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
    if (digits === undefined) throw new Error("no fraction digits");
    return digits;
  } catch {
    throw new Error(`Unknown currency: ${currency}`);
  }
}

const SUPPORTED_CURRENCIES =
  typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;

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
  // Float dust (0.1 + 0.2) is not a real extra decimal; a genuine digit past
  // the currency's decimals is, and throws rather than silently rounding.
  if (Math.abs(n - rounded) > 1e-9 * Math.max(1, Math.abs(n))) {
    throw new Error(`Invalid amount: ${input} has more decimals than ${currency} allows`);
  }
  return rounded.toFixed(digits);
}

/** ISO timestamp `hours` from now, for `expiresAt`. */
export function expiresInHours(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}
