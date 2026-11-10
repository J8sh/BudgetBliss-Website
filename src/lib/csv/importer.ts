import mongoose from "mongoose";
import { parseCsv, rowToRecord } from "@/lib/csv/csv";
import { formatCentsForCsv, toIsoDate } from "@/lib/csv/values";
import {
  detectKind,
  parseBudgetEntryRow,
  parseLineItemRow,
  parseReceiptRow,
  type BudgetEntryImportRow,
  type LineItemImportRow,
  type ReceiptImportRow,
} from "@/lib/csv/formats";
import { guessBankMapping, readBankRows, validateBankMapping } from "@/lib/csv/bankStatement";
import { Receipt } from "@/lib/models/Receipt";
import { Income } from "@/lib/models/Income";
import { RecurringCost } from "@/lib/models/RecurringCost";
import type {
  BankMapping,
  ImportCounts,
  ImportKind,
  ImportResult,
  ImportRowResult,
} from "@/types/dataTransfer";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** A bank row counts as a receipt you already have if the amount matches within this many days */
export const BANK_DUPLICATE_WINDOW_DAYS = 3;
const MAX_RESULT_ROWS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A problem with the whole file (shown to the user as-is) */
export class ImportError extends Error {}

export interface ImportOptions {
  csv: string;
  kind: ImportKind | "auto";
  mapping?: BankMapping;
  dryRun: boolean;
  skipDuplicates: boolean;
}

interface Plan {
  results: ImportRowResult[];
  /** Applies the planned writes; returns how many records were written */
  write: () => Promise<number>;
  mapping?: BankMapping;
}

const money = (cents: number) => `$${formatCentsForCsv(cents)}`;
const objectId = (id: string) => new mongoose.Types.ObjectId(id);

export async function runImport(opts: ImportOptions): Promise<ImportResult> {
  const { headers, rows } = parseCsv(opts.csv);
  if (headers.length === 0 || rows.length === 0) {
    throw new ImportError("The file has no rows to import.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(`The file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS}. Split it into smaller files.`);
  }

  const kind = opts.kind === "auto" ? detectKind(headers) : opts.kind;
  // Header names in our own formats are matched case-insensitively
  const records = rows.map((row) => rowToRecord(kind === "bank" ? headers : headers.map((h) => h.toLowerCase()), row));

  let plan: Plan;
  switch (kind) {
    case "receipts":
      plan = await planReceipts(records, opts.skipDuplicates);
      break;
    case "line-items":
      plan = await planLineItems(records);
      break;
    case "income":
    case "recurring":
      plan = await planBudgetEntries(records, kind, opts.skipDuplicates);
      break;
    case "bank":
      plan = await planBank(headers, rows, opts.mapping, opts.skipDuplicates);
      break;
  }

  const written = opts.dryRun ? 0 : await plan.write();

  return {
    kind,
    headers,
    mapping: plan.mapping,
    counts: countStatuses(plan.results),
    written,
    dryRun: opts.dryRun,
    rows: pickResultRows(plan.results),
    totalRows: rows.length,
  };
}

function countStatuses(results: ImportRowResult[]): ImportCounts {
  const counts: ImportCounts = { create: 0, update: 0, duplicate: 0, skip: 0, error: 0 };
  for (const r of results) counts[r.status]++;
  return counts;
}

/** Every row for small files; for big ones, all problem rows plus a sample of the rest */
function pickResultRows(results: ImportRowResult[]): ImportRowResult[] {
  if (results.length <= MAX_RESULT_ROWS) return results;
  const problems = results.filter((r) => r.status === "error" || r.status === "duplicate" || r.status === "skip");
  const others = results.filter((r) => r.status === "create" || r.status === "update").slice(0, 100);
  return [...problems.slice(0, MAX_RESULT_ROWS), ...others].sort((a, b) => a.line - b.line);
}

// Line numbers: header is line 1, so data row i is line i + 2
const lineOf = (index: number) => index + 2;

// ─── Receipts (BudgetBliss format) ───────────────────────────────────────────

async function planReceipts(records: Record<string, string>[], skipDuplicates: boolean): Promise<Plan> {
  const parsed = records.map(parseReceiptRow);
  const ids = parsed.flatMap((p) => (p.ok && p.value.id ? [p.value.id] : []));
  const existingIds = new Set(
    (await Receipt.find({ _id: { $in: ids.map(objectId) } }).select("_id").lean()).map((r) => r._id.toString()),
  );

  // Receipts on the same days, for spotting rows without an id that are already here
  const newRowDates = parsed.flatMap((p) => (p.ok && !p.value.id ? [p.value.receiptDate] : []));
  const sameDay = await loadReceiptsBetween(newRowDates, 0);

  const results: ImportRowResult[] = [];
  const inserts: ReceiptImportRow[] = [];
  const updates: ReceiptImportRow[] = [];
  const seenIds = new Set<string>();

  parsed.forEach((p, i) => {
    const line = lineOf(i);
    if (!p.ok) {
      results.push({ line, status: "error", summary: records[i]?.["store"] ?? "", message: p.error });
      return;
    }
    const r = p.value;
    const summary = `${r.receiptDate} · ${r.storeName} · ${money(r.grandTotal)}`;

    if (r.id && seenIds.has(r.id)) {
      results.push({ line, status: "error", summary, message: "This id appears more than once in the file" });
      return;
    }
    if (r.id) seenIds.add(r.id);

    if (r.id && existingIds.has(r.id)) {
      updates.push(r);
      results.push({ line, status: "update", summary });
      return;
    }

    if (!r.id) {
      const match = sameDay.find(
        (e) =>
          toIsoDate(e.receiptDate) === r.receiptDate &&
          e.grandTotal === r.grandTotal &&
          e.storeName.toLowerCase() === r.storeName.toLowerCase(),
      );
      if (match) {
        if (skipDuplicates) {
          results.push({ line, status: "duplicate", summary, message: "Same store, date and total as an existing receipt" });
          return;
        }
        inserts.push(r);
        results.push({ line, status: "create", summary, message: "Possible duplicate, importing anyway" });
        return;
      }
    }

    inserts.push(r);
    results.push({ line, status: "create", summary, message: r.id ? "Restored with its original id" : undefined });
  });

  return {
    results,
    write: async () => {
      const ops = [
        ...inserts.map((r) => ({
          insertOne: {
            document: {
              ...(r.id ? { _id: objectId(r.id) } : {}),
              ...receiptFields(r),
              extractionMethod: r.extractionMethod ?? "manual",
              isDuplicate: r.isDuplicate ?? false,
            },
          },
        })),
        ...updates.map((r) => {
          const fields = receiptFields(r);
          const set: Record<string, unknown> = {};
          const unset: Record<string, ""> = {};
          for (const [key, value] of Object.entries(fields)) {
            if (value === undefined) unset[key] = "";
            else set[key] = value;
          }
          if (r.extractionMethod) set["extractionMethod"] = r.extractionMethod;
          if (r.isDuplicate !== undefined) set["isDuplicate"] = r.isDuplicate;
          return {
            updateOne: {
              filter: { _id: objectId(r.id!) },
              update: Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
            },
          };
        }),
      ];
      if (ops.length === 0) return 0;
      const res = await Receipt.bulkWrite(ops, { ordered: false });
      // Updates count even when the row matched what was already stored
      return res.insertedCount + updates.length;
    },
  };
}

/** The editable receipt fields a CSV row carries (undefined = empty cell) */
function receiptFields(r: ReceiptImportRow) {
  return {
    receiptDate: new Date(r.receiptDate),
    storeName: r.storeName,
    storeAddress: r.storeAddress,
    paymentMethod: r.paymentMethod,
    cardLastFour: r.cardLastFour,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    grandTotal: r.grandTotal,
    tags: r.tags,
    notes: r.notes,
  };
}

async function loadReceiptsBetween(isoDates: string[], paddingDays: number) {
  if (isoDates.length === 0) return [];
  const sorted = [...isoDates].sort();
  const from = new Date(new Date(sorted[0]!).getTime() - paddingDays * DAY_MS);
  const to = new Date(new Date(sorted[sorted.length - 1]!).getTime() + (paddingDays + 1) * DAY_MS);
  return Receipt.find({ receiptDate: { $gte: from, $lt: to } })
    .select("_id storeName receiptDate grandTotal")
    .lean();
}

// ─── Line items (BudgetBliss format) ─────────────────────────────────────────

async function planLineItems(records: Record<string, string>[]): Promise<Plan> {
  const parsed = records.map(parseLineItemRow);
  const receiptIds = [...new Set(parsed.flatMap((p) => (p.ok ? [p.value.receiptId] : [])))];
  const existing = new Map(
    (await Receipt.find({ _id: { $in: receiptIds.map(objectId) } }).select("_id storeName receiptDate").lean()).map(
      (r) => [r._id.toString(), r],
    ),
  );

  // A receipt's items are replaced as a set, so one bad row holds back its whole receipt
  const badReceipts = new Set<string>();
  parsed.forEach((p, i) => {
    if (!p.ok) {
      const id = (records[i]?.["receipt_id"] ?? "").trim().toLowerCase();
      if (id) badReceipts.add(id);
    }
  });

  const groups = new Map<string, LineItemImportRow[]>();
  const firstResultForReceipt = new Map<string, number>();
  const results: ImportRowResult[] = parsed.map((p, i): ImportRowResult => {
    const line = lineOf(i);
    if (!p.ok) return { line, status: "error", summary: records[i]?.["item"] ?? "", message: p.error };

    const item = p.value;
    const receipt = existing.get(item.receiptId);
    const summary = receipt
      ? `${toIsoDate(receipt.receiptDate)} · ${receipt.storeName} · ${item.name} · ${money(item.totalPrice)}`
      : `${item.name} · ${money(item.totalPrice)}`;

    if (!receipt) {
      return { line, status: "error", summary, message: "No receipt with this receipt_id. Import the receipts file first." };
    }
    if (badReceipts.has(item.receiptId)) {
      return { line, status: "skip", summary, message: "Another row for this receipt has an error" };
    }
    groups.set(item.receiptId, [...(groups.get(item.receiptId) ?? []), item]);
    if (!firstResultForReceipt.has(item.receiptId)) firstResultForReceipt.set(item.receiptId, i);
    return { line, status: "update", summary };
  });

  for (const [id, index] of firstResultForReceipt) {
    results[index]!.message = `Replaces this receipt's items with the ${groups.get(id)!.length} in this file`;
  }

  return {
    results,
    write: async () => {
      if (groups.size === 0) return 0;
      await Receipt.bulkWrite(
        [...groups].map(([id, items]) => ({
          updateOne: {
            filter: { _id: objectId(id) },
            update: {
              $set: {
                lineItems: items.map(({ receiptId: _r, ...item }) => item),
              },
            },
          },
        })),
        { ordered: false },
      );
      return [...groups.values()].reduce((n, items) => n + items.length, 0);
    },
  };
}

// ─── Income & recurring costs (BudgetBliss format) ───────────────────────────

async function planBudgetEntries(
  records: Record<string, string>[],
  kind: "income" | "recurring",
  skipDuplicates: boolean,
): Promise<Plan> {
  const model = (kind === "income" ? Income : RecurringCost) as unknown as mongoose.Model<{
    name: string;
    amount: number;
    frequency: string;
  }>;
  const parsed = records.map((r) => parseBudgetEntryRow(r, kind));
  const all = await model.find({}).select("_id name amount frequency").lean();
  const existingIds = new Set(all.map((e) => e._id.toString()));

  const results: ImportRowResult[] = [];
  const inserts: BudgetEntryImportRow[] = [];
  const updates: BudgetEntryImportRow[] = [];
  const seenIds = new Set<string>();

  parsed.forEach((p, i) => {
    const line = lineOf(i);
    if (!p.ok) {
      results.push({ line, status: "error", summary: "", message: p.error });
      return;
    }
    const e = p.value;
    const summary = `${e.name} · ${money(e.amount)} ${e.frequency}`;

    if (e.id && seenIds.has(e.id)) {
      results.push({ line, status: "error", summary, message: "This id appears more than once in the file" });
      return;
    }
    if (e.id) seenIds.add(e.id);

    if (e.id && existingIds.has(e.id)) {
      updates.push(e);
      results.push({ line, status: "update", summary });
      return;
    }

    if (!e.id) {
      const match = all.find(
        (x) => x.name.toLowerCase() === e.name.toLowerCase() && x.amount === e.amount && x.frequency === e.frequency,
      );
      if (match && skipDuplicates) {
        results.push({ line, status: "duplicate", summary, message: "Same name, amount and frequency already exists" });
        return;
      }
    }

    inserts.push(e);
    results.push({ line, status: "create", summary });
  });

  return {
    results,
    write: async () => {
      const fields = (e: BudgetEntryImportRow) => ({
        name: e.name,
        amount: e.amount,
        frequency: e.frequency,
        category: e.category,
        notes: e.notes,
        isActive: e.isActive,
      });
      const ops = [
        ...inserts.map((e) => ({
          insertOne: { document: { ...(e.id ? { _id: objectId(e.id) } : {}), ...fields(e) } },
        })),
        ...updates.map((e) => {
          const set: Record<string, unknown> = {};
          const unset: Record<string, ""> = {};
          for (const [key, value] of Object.entries(fields(e))) {
            if (value === undefined) unset[key] = "";
            else set[key] = value;
          }
          return {
            updateOne: {
              filter: { _id: objectId(e.id!) },
              update: Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
            },
          };
        }),
      ];
      if (ops.length === 0) return 0;
      await model.bulkWrite(ops as Parameters<typeof model.bulkWrite>[0], { ordered: false });
      return ops.length;
    },
  };
}

// ─── Bank / card statements ──────────────────────────────────────────────────

async function planBank(
  headers: string[],
  rows: string[][],
  requested: BankMapping | undefined,
  skipDuplicates: boolean,
): Promise<Plan> {
  const mapping = requested ?? guessBankMapping(headers, rows);
  const problem = validateBankMapping(mapping, headers);
  if (problem) {
    // Return the guessed mapping so the user can fix it, with nothing planned
    return {
      mapping,
      results: rows.map((_, i) => ({ line: lineOf(i), status: "skip", summary: "", message: problem })),
      write: async () => 0,
    };
  }

  const bankRows = readBankRows(headers, rows, mapping);
  const existing = await loadReceiptsBetween(
    bankRows.flatMap((r) => (r.ok ? [r.date] : [])),
    BANK_DUPLICATE_WINDOW_DAYS,
  );
  const claimed = new Set<string>(); // each existing receipt can only match one statement row

  const inserts: Array<{ date: string; description: string; spendingCents: number }> = [];
  const results = bankRows.map((r, i): ImportRowResult => {
    const line = lineOf(i);
    if (!r.ok) {
      const summary = [r.date, r.description].filter(Boolean).join(" · ");
      return { line, status: r.reason, summary, message: r.message };
    }

    const summary = `${r.date} · ${r.description} · ${money(r.spendingCents)}`;
    const rowTime = new Date(r.date).getTime();
    const match = existing.find(
      (e) =>
        !claimed.has(e._id.toString()) &&
        e.grandTotal === r.spendingCents &&
        Math.abs(e.receiptDate.getTime() - rowTime) <= BANK_DUPLICATE_WINDOW_DAYS * DAY_MS,
    );

    if (match) {
      claimed.add(match._id.toString());
      const message = `Matches ${match.storeName} on ${toIsoDate(match.receiptDate)}`;
      if (skipDuplicates) return { line, status: "duplicate", summary, message };
      inserts.push(r);
      return { line, status: "create", summary, message: `${message}, importing anyway` };
    }

    inserts.push(r);
    return { line, status: "create", summary };
  });

  return {
    mapping,
    results,
    write: async () => {
      if (inserts.length === 0) return 0;
      const docs = await Receipt.insertMany(
        inserts.map((r) => ({
          storeName: r.description,
          receiptDate: new Date(r.date),
          grandTotal: r.spendingCents,
          extractionMethod: "manual",
          tags: ["bank-import"],
          lineItems: [],
        })),
        { ordered: false },
      );
      return docs.length;
    },
  };
}
