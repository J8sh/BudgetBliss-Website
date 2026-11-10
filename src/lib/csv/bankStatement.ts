import { unguardFormula } from "@/lib/csv/csv";
import { detectDateFormat, parseAmountToCents, parseDateToIso } from "@/lib/csv/values";
import type { BankMapping } from "@/types/dataTransfer";

/**
 * Bank and card statement CSVs: every bank names its columns differently, so the user maps
 * them once (we guess first). Purchases become receipts; payments, refunds and deposits are skipped.
 */

function findHeader(headers: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = headers.find((h) => pattern.test(h.trim()));
    if (match) return match;
  }
  return undefined;
}

/** Best guess at which columns hold what, from header names and the amounts' signs */
export function guessBankMapping(headers: string[], rows: string[][]): BankMapping {
  const date =
    findHeader(headers, [/^(transaction|trans\.?) ?date$/i, /^date$/i, /^posted? ?date$/i, /date/i]) ?? "";
  const description =
    findHeader(headers, [/^description$/i, /^(merchant|payee)( name)?$/i, /^(name|memo|details)$/i, /description|merchant|payee|memo/i]) ?? "";
  const amount = findHeader(headers, [/^amount$/i, /^transaction amount$/i, /amount/i]);
  const debit = findHeader(headers, [/^debit( amount)?$/i, /withdrawal/i, /money out/i, /debit/i]);
  const credit = findHeader(headers, [/^credit( amount)?$/i, /deposit/i, /money in/i, /credit/i]);

  const mapping: BankMapping = { date, description, spendingIs: "negative", dateFormat: "auto" };

  if (amount) {
    mapping.amount = amount;
    // Most banks show purchases as negative; card issuers like Amex show them as positive
    const index = headers.indexOf(amount);
    let negatives = 0;
    let positives = 0;
    for (const row of rows.slice(0, 200)) {
      const cents = parseAmountToCents(row[index] ?? "");
      if (cents === null || cents === 0) continue;
      if (cents < 0) negatives++;
      else positives++;
    }
    mapping.spendingIs = positives > negatives ? "positive" : "negative";
  } else if (debit) {
    mapping.debit = debit;
    if (credit) mapping.credit = credit;
  }

  return mapping;
}

/** Problems with a mapping against these headers, or null if it's usable */
export function validateBankMapping(mapping: BankMapping, headers: string[]): string | null {
  const has = (h: string | undefined) => !!h && headers.includes(h);
  if (!has(mapping.date)) return "Choose the column that holds the date.";
  if (!has(mapping.description)) return "Choose the column that holds the description or merchant.";
  if (!has(mapping.amount) && !has(mapping.debit)) {
    return "Choose the amount column (or the debit/withdrawal column).";
  }
  if (mapping.credit && !has(mapping.credit)) return "The chosen credit column isn't in this file.";
  return null;
}

export type BankRow =
  | { ok: true; date: string; description: string; spendingCents: number }
  | { ok: false; reason: "error" | "skip"; message: string; date?: string; description?: string };

/** Turns statement rows into purchases (positive cents) using a validated mapping */
export function readBankRows(headers: string[], rows: string[][], mapping: BankMapping): BankRow[] {
  const col = (name: string | undefined) => (name ? headers.indexOf(name) : -1);
  const dateCol = col(mapping.date);
  const descCol = col(mapping.description);
  const amountCol = col(mapping.amount);
  const debitCol = col(mapping.debit);
  const creditCol = col(mapping.credit);

  const dateFormat =
    mapping.dateFormat === "auto" ? detectDateFormat(rows.map((r) => r[dateCol] ?? "")) : mapping.dateFormat;

  return rows.map((row): BankRow => {
    const rawDate = (row[dateCol] ?? "").trim();
    const description = unguardFormula((row[descCol] ?? "").trim()).replace(/\s+/g, " ").slice(0, 200);
    const date = parseDateToIso(rawDate, dateFormat);

    if (!date) return { ok: false, reason: "error", message: `date "${rawDate}" isn't a date`, description };
    if (!description) return { ok: false, reason: "error", message: "description is empty", date };

    let spending: number | null;
    if (amountCol >= 0) {
      const raw = row[amountCol] ?? "";
      const cents = parseAmountToCents(raw);
      if (cents === null) return { ok: false, reason: "error", message: `amount "${raw}" isn't an amount`, date, description };
      spending = mapping.spendingIs === "negative" ? -cents : cents;
    } else {
      const debit = parseAmountToCents(row[debitCol] ?? "");
      const credit = creditCol >= 0 ? parseAmountToCents(row[creditCol] ?? "") : null;
      if (debit === null && credit === null) {
        return { ok: false, reason: "error", message: "no debit or credit amount", date, description };
      }
      spending = debit !== null && debit !== 0 ? Math.abs(debit) : -Math.abs(credit ?? 0);
    }

    if (spending <= 0) {
      return { ok: false, reason: "skip", message: "Not a purchase (payment, refund or deposit)", date, description };
    }
    return { ok: true, date, description, spendingCents: spending };
  });
}
