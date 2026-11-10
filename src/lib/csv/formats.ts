import { guardFormula, unguardFormula } from "@/lib/csv/csv";
import { formatCentsForCsv, parseAmountToCents, parseBoolean, parseDateToIso, toIsoDate } from "@/lib/csv/values";
import { INCOME_CATEGORIES, RECURRING_FREQUENCIES } from "@/lib/utils/validators";
import type { ExportType, ImportKind } from "@/types/dataTransfer";
import type { ExtractionMethod, PaymentMethod } from "@/types/receipt";

/**
 * Column layouts of the CSVs BudgetBliss exports. Importing a file with one of these header
 * sets round-trips it: rows with a known id update that record, others are created.
 */

export const RECEIPT_HEADERS = [
  "id", "date", "store", "store_address", "payment_method", "card_last_four",
  "subtotal", "tax", "total", "tags", "notes", "extraction_method", "is_duplicate", "created_at",
] as const;

export const LINE_ITEM_HEADERS = [
  "receipt_id", "date", "store", "item", "description", "quantity", "unit_price", "total_price", "category",
] as const;

export const INCOME_HEADERS = ["id", "income_source", "amount", "frequency", "category", "notes", "active"] as const;

export const RECURRING_HEADERS = ["id", "recurring_cost", "amount", "frequency", "category", "notes", "active"] as const;

export const HEADERS_BY_TYPE: Record<ExportType, readonly string[]> = {
  receipts: RECEIPT_HEADERS,
  "line-items": LINE_ITEM_HEADERS,
  income: INCOME_HEADERS,
  recurring: RECURRING_HEADERS,
};

/** Recognizes BudgetBliss's own files by their headers; anything else is a bank statement */
export function detectKind(headers: string[]): ImportKind {
  const h = new Set(headers.map((x) => x.trim().toLowerCase()));
  if (h.has("receipt_id") && h.has("item")) return "line-items";
  if (h.has("income_source") && h.has("amount")) return "income";
  if (h.has("recurring_cost") && h.has("amount")) return "recurring";
  if (h.has("store") && h.has("total") && h.has("date")) return "receipts";
  return "bank";
}

// ─── Export rows ─────────────────────────────────────────────────────────────

const text = (v: string | undefined | null) => guardFormula(v ?? "");

export interface ReceiptLike {
  _id: { toString(): string };
  receiptDate: Date;
  storeName: string;
  storeAddress?: string;
  paymentMethod?: string;
  cardLastFour?: string;
  subtotal?: number;
  taxAmount?: number;
  grandTotal: number;
  tags?: string[];
  notes?: string;
  extractionMethod?: string;
  isDuplicate?: boolean;
  createdAt?: Date;
  lineItems?: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
  }>;
}

export function receiptToRow(r: ReceiptLike): string[] {
  return [
    r._id.toString(),
    toIsoDate(r.receiptDate),
    text(r.storeName),
    text(r.storeAddress),
    r.paymentMethod ?? "",
    r.cardLastFour ?? "",
    formatCentsForCsv(r.subtotal),
    formatCentsForCsv(r.taxAmount),
    formatCentsForCsv(r.grandTotal),
    text((r.tags ?? []).join("; ")),
    text(r.notes),
    r.extractionMethod ?? "",
    r.isDuplicate ? "true" : "false",
    r.createdAt ? r.createdAt.toISOString() : "",
  ];
}

export function lineItemRows(r: ReceiptLike): string[][] {
  return (r.lineItems ?? []).map((item) => [
    r._id.toString(),
    toIsoDate(r.receiptDate),
    text(r.storeName),
    text(item.name),
    text(item.description),
    String(item.quantity),
    formatCentsForCsv(item.unitPrice),
    formatCentsForCsv(item.totalPrice),
    text(item.category),
  ]);
}

export interface BudgetEntryLike {
  _id: { toString(): string };
  name: string;
  amount: number;
  frequency: string;
  category?: string;
  notes?: string;
  isActive: boolean;
}

export function budgetEntryToRow(e: BudgetEntryLike): string[] {
  return [
    e._id.toString(),
    text(e.name),
    formatCentsForCsv(e.amount),
    e.frequency,
    text(e.category),
    text(e.notes),
    e.isActive ? "true" : "false",
  ];
}

// ─── Import rows ─────────────────────────────────────────────────────────────

export type RowParse<T> = { ok: true; value: T } | { ok: false; error: string };

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const PAYMENT_METHODS = ["card", "cash", "other"] as const;
const EXTRACTION_METHODS = ["claude", "manual", "claude-partial", "failed"] as const;

function cell(record: Record<string, string>, key: string): string {
  return unguardFormula((record[key] ?? "").trim());
}

function optionalId(record: Record<string, string>, key: string): RowParse<string | undefined> {
  const id = cell(record, key);
  if (id === "") return { ok: true, value: undefined };
  return OBJECT_ID.test(id) ? { ok: true, value: id.toLowerCase() } : { ok: false, error: `${key} "${id}" isn't a valid id` };
}

function money(record: Record<string, string>, key: string, opts: { required: boolean; min?: number }): RowParse<number | undefined> {
  const raw = cell(record, key);
  if (raw === "") return opts.required ? { ok: false, error: `${key} is required` } : { ok: true, value: undefined };
  const cents = parseAmountToCents(raw);
  if (cents === null) return { ok: false, error: `${key} "${raw}" isn't an amount` };
  if (opts.min !== undefined && cents < opts.min) {
    return { ok: false, error: `${key} must be at least ${formatCentsForCsv(opts.min)}` };
  }
  return { ok: true, value: cents };
}

export interface ReceiptImportRow {
  id?: string;
  receiptDate: string;
  storeName: string;
  storeAddress?: string;
  paymentMethod?: PaymentMethod;
  cardLastFour?: string;
  subtotal?: number;
  taxAmount?: number;
  grandTotal: number;
  tags: string[];
  notes?: string;
  extractionMethod?: ExtractionMethod;
  isDuplicate?: boolean;
}

export function parseReceiptRow(record: Record<string, string>): RowParse<ReceiptImportRow> {
  const id = optionalId(record, "id");
  if (!id.ok) return id;

  const date = parseDateToIso(cell(record, "date"));
  if (!date) return { ok: false, error: `date "${cell(record, "date")}" isn't a date (use YYYY-MM-DD)` };

  const storeName = cell(record, "store");
  if (!storeName) return { ok: false, error: "store is required" };

  const total = money(record, "total", { required: true, min: 0 });
  if (!total.ok) return total;
  const subtotal = money(record, "subtotal", { required: false, min: 0 });
  if (!subtotal.ok) return subtotal;
  const tax = money(record, "tax", { required: false, min: 0 });
  if (!tax.ok) return tax;

  const payment = cell(record, "payment_method").toLowerCase();
  if (payment && !(PAYMENT_METHODS as readonly string[]).includes(payment)) {
    return { ok: false, error: `payment_method must be card, cash or other` };
  }

  // Spreadsheets drop leading zeros from "0123"
  let card = cell(record, "card_last_four");
  if (/^\d{1,3}$/.test(card)) card = card.padStart(4, "0");
  if (card && !/^\d{4}$/.test(card)) return { ok: false, error: "card_last_four must be 4 digits" };

  const extraction = cell(record, "extraction_method").toLowerCase();
  if (extraction && !(EXTRACTION_METHODS as readonly string[]).includes(extraction)) {
    return { ok: false, error: `extraction_method "${extraction}" isn't recognized` };
  }

  const isDuplicate = parseBoolean(cell(record, "is_duplicate"));
  if (isDuplicate === null) return { ok: false, error: "is_duplicate must be true or false" };

  return {
    ok: true,
    value: {
      id: id.value,
      receiptDate: date,
      storeName,
      storeAddress: cell(record, "store_address") || undefined,
      paymentMethod: (payment || undefined) as PaymentMethod | undefined,
      cardLastFour: card || undefined,
      subtotal: subtotal.value,
      taxAmount: tax.value,
      grandTotal: total.value!,
      tags: cell(record, "tags").split(";").map((t) => t.trim()).filter(Boolean),
      notes: cell(record, "notes") || undefined,
      extractionMethod: (extraction || undefined) as ExtractionMethod | undefined,
      isDuplicate,
    },
  };
}

export interface LineItemImportRow {
  receiptId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export function parseLineItemRow(record: Record<string, string>): RowParse<LineItemImportRow> {
  const id = optionalId(record, "receipt_id");
  if (!id.ok) return id;
  if (!id.value) return { ok: false, error: "receipt_id is required" };

  const name = cell(record, "item");
  if (!name) return { ok: false, error: "item is required" };

  const qtyRaw = cell(record, "quantity");
  const quantity = qtyRaw === "" ? 1 : Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, error: `quantity "${qtyRaw}" isn't a number` };

  const total = money(record, "total_price", { required: true });
  if (!total.ok) return total;
  const unit = money(record, "unit_price", { required: false });
  if (!unit.ok) return unit;

  return {
    ok: true,
    value: {
      receiptId: id.value,
      name,
      description: cell(record, "description") || undefined,
      quantity,
      unitPrice: unit.value ?? total.value!,
      totalPrice: total.value!,
      category: cell(record, "category") || undefined,
    },
  };
}

export interface BudgetEntryImportRow {
  id?: string;
  name: string;
  amount: number;
  frequency: (typeof RECURRING_FREQUENCIES)[number];
  category?: string;
  notes?: string;
  isActive: boolean;
}

/** Parses an income (nameColumn "income_source") or recurring cost ("recurring_cost") row */
export function parseBudgetEntryRow(
  record: Record<string, string>,
  kind: "income" | "recurring",
): RowParse<BudgetEntryImportRow> {
  const nameColumn = kind === "income" ? "income_source" : "recurring_cost";

  const id = optionalId(record, "id");
  if (!id.ok) return id;

  const name = cell(record, nameColumn);
  if (!name) return { ok: false, error: `${nameColumn} is required` };

  const amount = money(record, "amount", { required: true, min: 1 });
  if (!amount.ok) return amount;

  const frequency = cell(record, "frequency").toLowerCase();
  if (!(RECURRING_FREQUENCIES as readonly string[]).includes(frequency)) {
    return { ok: false, error: "frequency must be weekly, monthly, quarterly or yearly" };
  }

  const category = cell(record, "category");
  if (kind === "income" && category && !(INCOME_CATEGORIES as readonly string[]).includes(category.toLowerCase())) {
    return { ok: false, error: `category must be one of: ${INCOME_CATEGORIES.join(", ")}` };
  }

  const active = parseBoolean(cell(record, "active"));
  if (active === null) return { ok: false, error: "active must be true or false" };

  return {
    ok: true,
    value: {
      id: id.value,
      name,
      amount: amount.value!,
      frequency: frequency as BudgetEntryImportRow["frequency"],
      category: (kind === "income" ? category.toLowerCase() : category) || undefined,
      notes: cell(record, "notes") || undefined,
      isActive: active ?? true,
    },
  };
}
