/**
 * Parsing and formatting of CSV cell values: money, dates and booleans.
 * Money is exchanged in CSV as decimal dollars ("12.50") and stored as integer cents.
 */

export type DateFormat = "auto" | "mdy" | "dmy";

/** Integer cents → "12.50" / "-3.00" (no currency symbol, so spreadsheets read it as a number) */
export function formatCentsForCsv(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Parses amounts as banks write them: "$1,234.56", "-12.34", "(12.34)", "12.34-", "1234".
 * Returns integer cents, or null if it isn't a number.
 */
export function parseAmountToCents(input: string): number | null {
  let value = input.trim();
  if (value === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.endsWith("-")) {
    negative = !negative;
    value = value.slice(0, -1);
  }
  value = value.replace(/[$\s,]/g, "");
  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(value)) return null;

  const [whole = "0", fraction = ""] = value.split(".");
  // Round half up on the third decimal place, working on digits to avoid float error
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  const roundUp = fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0;
  const total = cents + roundUp;
  return negative ? -total : total;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Picks month/day order for a column of dates: day-first if any first part is over 12,
 * otherwise month-first (US banks). YYYY-MM-DD dates are read the same either way.
 */
export function detectDateFormat(values: string[]): "mdy" | "dmy" {
  for (const v of values) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(v.trim());
    if (m && Number(m[1]) > 12) return "dmy";
  }
  return "mdy";
}

/**
 * Parses a date cell to "YYYY-MM-DD". Accepts YYYY-MM-DD (optionally followed by a time) and
 * slash/dash/dot dates in the given order. Returns null if it isn't a real date.
 */
export function parseDateToIso(input: string, format: DateFormat = "auto"): string | null {
  const s = input.trim();

  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(s);
  if (ymd) {
    const [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
    return isValidYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  const parts = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:$|\s)/.exec(s);
  if (!parts) return null;

  const a = Number(parts[1]);
  const b = Number(parts[2]);
  const y = expandYear(Number(parts[3]));
  const order = format === "auto" ? (a > 12 ? "dmy" : "mdy") : format;
  const [m, d] = order === "dmy" ? [b, a] : [a, b];
  return isValidYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** "true"/"yes"/"1"/"y" → true, "false"/"no"/"0"/"n" → false, "" → undefined, else null */
export function parseBoolean(input: string): boolean | undefined | null {
  const s = input.trim().toLowerCase();
  if (s === "") return undefined;
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return null;
}

/** Date → "YYYY-MM-DD" in UTC (receipt dates are stored as UTC midnight) */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
