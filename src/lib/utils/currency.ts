/**
 * All monetary values are stored as integer cents in MongoDB.
 * Convert to/from cents ONLY at the API boundary using these helpers.
 * NEVER store floats for money.
 */

/** Convert decimal dollar amount to integer cents. E.g. 12.50 → 1250 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert integer cents to decimal dollars. E.g. 1250 → 12.5 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Format integer cents as a currency string. E.g. 1250 → "$12.50" */
export function formatCurrency(cents: number, locale = "en-US", currency = "USD"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Parse a currency string to cents. Returns null if unparseable. */
export function parseCurrencyToCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return toCents(parsed);
}
