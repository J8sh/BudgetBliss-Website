import { createHash } from "crypto";
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
import { BANK_MATCH_WINDOW_DAYS } from "@/lib/csv/bankMatch";
import { guessMerchant, isExclusion } from "@/lib/finance/categories";
import { loadRules } from "@/lib/finance/loadInsights";
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

/*
 * How duplicates are kept out, from strongest to weakest:
 *
 * 1. Import keys. Every receipt created from a CSV row without an id stores a fingerprint of
 *    that row (date, description/store, amount, and which repeat of an identical row it is).
 *    A unique index on it means the same statement line can't be imported twice: not from
 *    the same file, an overlapping statement, or two imports running at once. These are
 *    always skipped.
 * 2. Ids. Rows from BudgetBliss's own exports carry an id and update that record.
 * 3. Look-alikes. A row matching an existing receipt (bank: same amount within 3 days; own
 *    format: same store, date and total), or an identical earlier row in the same hand-made
 *    file, is skipped by default. The user can import these anyway.
 */

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
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

// ─── Duplicate helpers ───────────────────────────────────────────────────────

/**
 * Fingerprint for a CSV row. `occurrence` separates genuinely repeated rows (two identical
 * coffees on one statement) so each still imports once, and only once.
 */
function importKey(kind: "bank" | "receipt", parts: Array<string | number>, occurrence: number): string {
  const hash = createHash("sha256").update([...parts, occurrence].join("\u001f")).digest("hex").slice(0, 32);
  return `${kind}:${hash}`;
}

/** For each item, how many earlier items share its identity (0 for the first), and where the first one was */
function countRepeats<T>(items: Array<T | null>, identity: (item: T) => string): Array<{ occurrence: number; firstIndex: number }> {
  const seen = new Map<string, { count: number; firstIndex: number }>();
  return items.map((item, i) => {
    if (item === null) return { occurrence: 0, firstIndex: i };
    const id = identity(item);
    const prior = seen.get(id);
    if (prior) {
      prior.count++;
      return { occurrence: prior.count, firstIndex: prior.firstIndex };
    }
    seen.set(id, { count: 0, firstIndex: i });
    return { occurrence: 0, firstIndex: i };
  });
}

/** Existing receipts already holding any of these import keys, by key */
async function receiptsByImportKey(keys: string[]) {
  if (keys.length === 0) return new Map<string, { _id: mongoose.Types.ObjectId; createdAt: Date }>();
  const found = await Receipt.find({ importKey: { $in: keys } }).select("_id importKey createdAt").lean();
  return new Map(found.map((r) => [r.importKey!, { _id: r._id, createdAt: r.createdAt }]));
}

/**
 * Inserts documents, quietly skipping any that hit a unique index (an import key or id that
 * another import wrote in the meantime). Returns how many were inserted.
 */
async function insertSkippingDuplicates(model: mongoose.Model<never>, docs: Record<string, unknown>[]): Promise<number> {
  if (docs.length === 0) return 0;
  try {
    const res = await model.bulkWrite(
      docs.map((document) => ({ insertOne: { document } })) as Parameters<typeof model.bulkWrite>[0],
      { ordered: false },
    );
    return res.insertedCount;
  } catch (err) {
    const e = err as { code?: number; writeErrors?: unknown; insertedCount?: number; result?: { insertedCount?: number } };
    const writeErrors = Array.isArray(e.writeErrors) ? e.writeErrors : e.writeErrors ? [e.writeErrors] : [];
    const onlyDuplicates =
      writeErrors.length > 0 ? writeErrors.every((w) => (w as { code?: number }).code === 11000) : e.code === 11000;
    if (!onlyDuplicates) throw err;
    return e.insertedCount ?? e.result?.insertedCount ?? 0;
  }
}

async function loadReceiptsBetween(isoDates: string[], paddingDays: number) {
  if (isoDates.length === 0) return [];
  const sorted = [...isoDates].sort();
  const from = new Date(new Date(sorted[0]!).getTime() - paddingDays * DAY_MS);
  const to = new Date(new Date(sorted[sorted.length - 1]!).getTime() + (paddingDays + 1) * DAY_MS);
  return Receipt.find({ receiptDate: { $gte: from, $lt: to } })
    .select("_id storeName receiptDate grandTotal importKey")
    .lean();
}

// ─── Receipts (BudgetBliss format) ───────────────────────────────────────────

async function planReceipts(records: Record<string, string>[], skipDuplicates: boolean): Promise<Plan> {
  const parsed = records.map(parseReceiptRow);
  const ids = parsed.flatMap((p) => (p.ok && p.value.id ? [p.value.id] : []));
  const existingIds = new Set(
    (await Receipt.find({ _id: { $in: ids.map(objectId) } }).select("_id").lean()).map((r) => r._id.toString()),
  );

  // Rows without an id are identified by date, store and total
  const noIdRows = parsed.map((p) => (p.ok && !p.value.id ? p.value : null));
  const identity = (r: ReceiptImportRow) => [r.receiptDate, r.storeName.toLowerCase(), r.grandTotal].join("|");
  const repeats = countRepeats(noIdRows, identity);
  const keys = noIdRows.map((r, i) =>
    r ? importKey("receipt", [r.receiptDate, r.storeName.toLowerCase(), r.grandTotal], repeats[i]!.occurrence) : null,
  );
  const restoredKeys = parsed.flatMap((p) => (p.ok && p.value.id && p.value.importKey ? [p.value.importKey] : []));
  const imported = await receiptsByImportKey([...keys.filter((k): k is string => k !== null), ...restoredKeys]);
  const sameDay = await loadReceiptsBetween(noIdRows.flatMap((r) => (r ? [r.receiptDate] : [])), 0);
  const claimed = new Set<string>([...imported.values()].map((r) => r._id.toString()));

  const results: ImportRowResult[] = [];
  const inserts: Array<{ row: ReceiptImportRow; key?: string }> = [];
  const updates: ReceiptImportRow[] = [];
  const seenIds = new Set<string>();

  parsed.forEach((p, i) => {
    const line = lineOf(i);
    if (!p.ok) {
      results.push({ line, status: "error", summary: records[i]?.["store"] ?? "", message: p.error });
      return;
    }
    const r = p.value;
    const base = {
      line,
      summary: `${r.receiptDate} · ${r.storeName} · ${money(r.grandTotal)}`,
      date: r.receiptDate,
      description: r.storeName,
      amountCents: r.grandTotal,
    };

    if (r.id) {
      if (seenIds.has(r.id)) {
        results.push({ ...base, status: "error", message: "This id appears more than once in the file" });
        return;
      }
      seenIds.add(r.id);
      if (existingIds.has(r.id)) {
        updates.push(r);
        results.push({ ...base, status: "update" });
        return;
      }
      const sameRow = r.importKey ? imported.get(r.importKey) : undefined;
      if (sameRow) {
        results.push({ ...base, status: "duplicate", message: `Already imported on ${toIsoDate(sameRow.createdAt)}` });
        return;
      }
      inserts.push({ row: r, key: r.importKey });
      results.push({ ...base, status: "create", message: "Restored with its original id" });
      return;
    }

    const key = keys[i]!;
    const already = imported.get(key);
    if (already) {
      results.push({ ...base, status: "duplicate", message: `Already imported on ${toIsoDate(already.createdAt)}` });
      return;
    }

    const repeat = repeats[i]!;
    const lookAlike = sameDay.find(
      (e) =>
        !claimed.has(e._id.toString()) &&
        toIsoDate(e.receiptDate) === r.receiptDate &&
        e.grandTotal === r.grandTotal &&
        e.storeName.toLowerCase() === r.storeName.toLowerCase(),
    );
    const reason = lookAlike
      ? "Same store, date and total as an existing receipt"
      : repeat.occurrence > 0
        ? `Same as line ${lineOf(repeat.firstIndex)} in this file`
        : null;
    if (lookAlike) claimed.add(lookAlike._id.toString());

    if (reason && skipDuplicates) {
      results.push({ ...base, status: "duplicate", message: reason });
      return;
    }
    inserts.push({ row: r, key });
    results.push({ ...base, status: "create", message: reason ? `${reason}, importing anyway` : undefined });
  });

  return {
    results,
    write: async () => {
      const inserted = await insertSkippingDuplicates(
        Receipt as unknown as mongoose.Model<never>,
        inserts.map(({ row, key }) => ({
          ...(row.id ? { _id: objectId(row.id) } : {}),
          ...receiptFields(row),
          extractionMethod: row.extractionMethod ?? "manual",
          isDuplicate: row.isDuplicate ?? false,
          ...(key ? { importKey: key } : {}),
        })),
      );

      if (updates.length > 0) {
        await Receipt.bulkWrite(
          updates.map((r) => {
            const set: Record<string, unknown> = {};
            const unset: Record<string, ""> = {};
            for (const [field, value] of Object.entries(receiptFields(r))) {
              if (value === undefined) unset[field] = "";
              else set[field] = value;
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
          { ordered: false },
        );
      }
      // Updates count even when the row matched what was already stored
      return inserted + updates.length;
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

// ─── Line items (BudgetBliss format) ─────────────────────────────────────────

async function planLineItems(records: Record<string, string>[]): Promise<Plan> {
  const parsed = records.map(parseLineItemRow);
  const receiptIds = [...new Set(parsed.flatMap((p) => (p.ok ? [p.value.receiptId] : [])))];
  const existing = new Map(
    (await Receipt.find({ _id: { $in: receiptIds.map(objectId) } }).select("_id storeName receiptDate").lean()).map(
      (r) => [r._id.toString(), r],
    ),
  );

  // A receipt's items are replaced as a set (so importing twice can't double them), and one
  // bad row holds back its whole receipt
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
    const date = receipt ? toIsoDate(receipt.receiptDate) : undefined;
    const summary = receipt
      ? `${date} · ${receipt.storeName} · ${item.name} · ${money(item.totalPrice)}`
      : `${item.name} · ${money(item.totalPrice)}`;
    const base = { line, summary, date, description: receipt ? `${receipt.storeName}: ${item.name}` : item.name, amountCents: item.totalPrice };

    if (!receipt) {
      return { ...base, status: "error", message: "No receipt with this receipt_id. Import the receipts file first." };
    }
    if (badReceipts.has(item.receiptId)) {
      return { ...base, status: "skip", message: "Another row for this receipt has an error" };
    }
    groups.set(item.receiptId, [...(groups.get(item.receiptId) ?? []), item]);
    if (!firstResultForReceipt.has(item.receiptId)) firstResultForReceipt.set(item.receiptId, i);
    return { ...base, status: "update" };
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
            update: { $set: { lineItems: items.map(({ receiptId: _r, ...item }) => item) } },
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

  const identity = (e: BudgetEntryImportRow) => [e.name.toLowerCase(), e.amount, e.frequency].join("|");
  const repeats = countRepeats(
    parsed.map((p) => (p.ok && !p.value.id ? p.value : null)),
    identity,
  );

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
    const base = { line, summary: `${e.name} · ${money(e.amount)} ${e.frequency}`, description: `${e.name} (${e.frequency})`, amountCents: e.amount };

    if (e.id) {
      if (seenIds.has(e.id)) {
        results.push({ ...base, status: "error", message: "This id appears more than once in the file" });
        return;
      }
      seenIds.add(e.id);
      if (existingIds.has(e.id)) {
        updates.push(e);
        results.push({ ...base, status: "update" });
      } else {
        inserts.push(e);
        results.push({ ...base, status: "create", message: "Restored with its original id" });
      }
      return;
    }

    const exists = all.some((x) => [x.name.toLowerCase(), x.amount, x.frequency].join("|") === identity(e));
    const repeat = repeats[i]!;
    const reason = exists
      ? "Same name, amount and frequency already exists"
      : repeat.occurrence > 0
        ? `Same as line ${lineOf(repeat.firstIndex)} in this file`
        : null;

    if (reason && skipDuplicates) {
      results.push({ ...base, status: "duplicate", message: reason });
      return;
    }
    inserts.push(e);
    results.push({ ...base, status: "create", message: reason ? `${reason}, importing anyway` : undefined });
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
      const inserted = await insertSkippingDuplicates(
        model as unknown as mongoose.Model<never>,
        inserts.map((e) => ({ ...(e.id ? { _id: objectId(e.id) } : {}), ...fields(e) })),
      );
      if (updates.length > 0) {
        await model.bulkWrite(
          updates.map((e) => {
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
          }) as Parameters<typeof model.bulkWrite>[0],
          { ordered: false },
        );
      }
      return inserted + updates.length;
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
  const purchases = bankRows.map((r) => (r.ok ? r : null));
  const identity = (r: { date: string; description: string; spendingCents: number }) =>
    [r.date, r.description.toUpperCase(), r.spendingCents].join("|");
  const repeats = countRepeats(purchases, identity);
  const keys = purchases.map((r, i) =>
    r ? importKey("bank", [r.date, r.description.toUpperCase(), r.spendingCents], repeats[i]!.occurrence) : null,
  );

  const imported = await receiptsByImportKey(keys.filter((k): k is string => k !== null));
  const rules = await loadRules();
  const isNotSpending = (description: string) => {
    const merchant = guessMerchant(description);
    const rule = rules.get(merchant.key);
    return isExclusion(rule) ? rule : rule ? undefined : merchant.excluded;
  };
  // A card payment or other transfer already in the database can't stand in for a purchase
  const nearby = (
    await loadReceiptsBetween(
      purchases.flatMap((r) => (r ? [r.date] : [])),
      BANK_MATCH_WINDOW_DAYS,
    )
  ).filter((e) => !isNotSpending(e.storeName));
  // Each existing receipt can stand in for only one statement row; exact matches claim theirs first
  const claimed = new Set<string>([...imported.values()].map((r) => r._id.toString()));

  const inserts: Array<{ date: string; description: string; spendingCents: number; key: string }> = [];
  const results = bankRows.map((r, i): ImportRowResult => {
    const line = lineOf(i);
    if (!r.ok) {
      const summary = [r.date, r.description].filter(Boolean).join(" · ");
      return { line, status: r.reason, summary, message: r.message, date: r.date, description: r.description };
    }

    const base = {
      line,
      summary: `${r.date} · ${r.description} · ${money(r.spendingCents)}`,
      date: r.date,
      description: r.description,
      amountCents: r.spendingCents,
    };

    // Money moved rather than spent (card payments, savings), or a bill already on the recurring list
    const exclusion = isNotSpending(r.description);
    if (exclusion) {
      const rule = rules.get(guessMerchant(r.description).key);
      return {
        ...base,
        status: "skip",
        message:
          exclusion === "bill"
            ? "Already counted as a recurring bill"
            : rule
              ? "You marked this as not spending"
              : "Looks like a card payment or transfer, so it isn't spending",
      };
    }

    const key = keys[i]!;
    const already = imported.get(key);
    if (already) {
      return { ...base, status: "duplicate", message: `Already imported on ${toIsoDate(already.createdAt)}` };
    }

    const rowTime = new Date(r.date).getTime();
    // A photo or typed-in receipt names the store differently from the bank, so the amount and date
    // decide. Two bank rows (say, from your card and your checking account) are only the same purchase
    // if they're also from the same store: a $20 snack isn't a $20 subscription.
    const rowMerchant = guessMerchant(r.description).key;
    const match = nearby.find(
      (e) =>
        !claimed.has(e._id.toString()) &&
        e.grandTotal === r.spendingCents &&
        Math.abs(e.receiptDate.getTime() - rowTime) <= BANK_MATCH_WINDOW_DAYS * DAY_MS &&
        (!e.importKey || guessMerchant(e.storeName).key === rowMerchant),
    );

    if (match) {
      claimed.add(match._id.toString());
      const message = `Matches ${match.storeName} on ${toIsoDate(match.receiptDate)}`;
      if (skipDuplicates) return { ...base, status: "duplicate", message };
      inserts.push({ ...r, key });
      return { ...base, status: "create", message: `${message}, importing anyway` };
    }

    inserts.push({ ...r, key });
    return {
      ...base,
      status: "create",
      message: repeats[i]!.occurrence > 0 ? `Same as line ${lineOf(repeats[i]!.firstIndex)}; statements list each charge once, so both are kept` : undefined,
    };
  });

  return {
    mapping,
    results,
    write: () =>
      insertSkippingDuplicates(
        Receipt as unknown as mongoose.Model<never>,
        inserts.map((r) => ({
          storeName: r.description,
          receiptDate: new Date(r.date),
          grandTotal: r.spendingCents,
          extractionMethod: "manual",
          tags: ["bank-import"],
          lineItems: [],
          importKey: r.key,
        })),
      ),
  };
}
