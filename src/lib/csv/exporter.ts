import { toCsv } from "@/lib/csv/csv";
import {
  budgetEntryToRow,
  HEADERS_BY_TYPE,
  lineItemRows,
  receiptToRow,
  type ReceiptLike,
} from "@/lib/csv/formats";
import { toIsoDate } from "@/lib/csv/values";
import { Receipt } from "@/lib/models/Receipt";
import { Income } from "@/lib/models/Income";
import { RecurringCost } from "@/lib/models/RecurringCost";
import type { ExportType } from "@/types/dataTransfer";

export interface ExportOptions {
  /** Inclusive YYYY-MM-DD bounds on the receipt date (receipts and line items only) */
  from?: string;
  to?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function receiptDateFilter({ from, to }: ExportOptions): Record<string, unknown> {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range["$gte"] = new Date(from);
  if (to) range["$lt"] = new Date(new Date(to).getTime() + DAY_MS);
  return { receiptDate: range };
}

/** Builds one CSV export and a filename for it */
export async function buildExport(
  type: ExportType,
  opts: ExportOptions = {},
): Promise<{ filename: string; csv: string; rowCount: number }> {
  let rows: string[][];

  switch (type) {
    case "receipts":
    case "line-items": {
      const receipts = (await Receipt.find(receiptDateFilter(opts))
        .sort({ receiptDate: 1, createdAt: 1 })
        .lean()) as unknown as ReceiptLike[];
      rows = type === "receipts" ? receipts.map(receiptToRow) : receipts.flatMap(lineItemRows);
      break;
    }
    case "income":
      rows = (await Income.find({}).sort({ createdAt: 1 }).lean()).map(budgetEntryToRow);
      break;
    case "recurring":
      rows = (await RecurringCost.find({}).sort({ createdAt: 1 }).lean()).map(budgetEntryToRow);
      break;
  }

  const range = opts.from || opts.to ? `-${opts.from ?? "start"}-to-${opts.to ?? "now"}` : "";
  return {
    filename: `budgetbliss-${type}${range}-${toIsoDate(new Date())}.csv`,
    csv: toCsv(HEADERS_BY_TYPE[type], rows),
    rowCount: rows.length,
  };
}
