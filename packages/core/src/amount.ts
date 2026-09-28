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

/** Normalize user input like "50", "50.5", "$50" into Crossmint's decimal string. */
export function toDecimalString(input: string | number): string {
  const cleaned = typeof input === "number" ? String(input) : input.replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${input}`);
  return n.toFixed(2);
}

/** ISO timestamp `hours` from now, for `expiresAt`. */
export function expiresInHours(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}
