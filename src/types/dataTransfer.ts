import type { DateFormat } from "@/lib/csv/values";

/** The CSV files BudgetBliss exports (and recognizes on import) */
export type ExportType = "receipts" | "line-items" | "income" | "recurring";

/** What an imported file is treated as */
export type ImportKind = ExportType | "bank";

/** Which columns of a bank/card statement hold what (values are header names) */
export interface BankMapping {
  date: string;
  description: string;
  /** One signed amount column... */
  amount?: string;
  /** ...or separate money-out / money-in columns */
  debit?: string;
  credit?: string;
  /** For a single amount column: whether purchases are written as negative or positive */
  spendingIs: "negative" | "positive";
  dateFormat: DateFormat;
}

export type ImportRowStatus = "create" | "update" | "duplicate" | "skip" | "error";

export interface ImportRowResult {
  /** 1-based line in the file, counting the header as line 1 */
  line: number;
  status: ImportRowStatus;
  /** Short human description of the row, e.g. "2026-01-05 · Starbucks · $5.25" */
  summary: string;
  message?: string;
}

export interface ImportCounts {
  create: number;
  update: number;
  duplicate: number;
  skip: number;
  error: number;
}

export interface ImportResult {
  kind: ImportKind;
  headers: string[];
  /** Present for bank imports: the mapping used (guessed if none was sent) */
  mapping?: BankMapping;
  counts: ImportCounts;
  /** Rows written (0 for a dry run) */
  written: number;
  dryRun: boolean;
  /** Per-row results, capped for large files */
  rows: ImportRowResult[];
  totalRows: number;
}
