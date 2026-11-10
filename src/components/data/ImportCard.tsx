"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, CheckCircle2, FileUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parseCsv } from "@/lib/csv/csv";
import { formatCurrency } from "@/lib/utils/currency";
import type { BankMapping, ImportCounts, ImportKind, ImportResult, ImportRowResult, ImportRowStatus } from "@/types/dataTransfer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const KIND_LABELS: Record<ImportKind, string> = {
  receipts: "BudgetBliss receipts export",
  "line-items": "BudgetBliss line items export",
  income: "BudgetBliss income export",
  recurring: "BudgetBliss recurring costs export",
  bank: "Bank or card statement",
};

const STATUS_LABELS: Record<ImportRowStatus, string> = {
  create: "New",
  update: "Update",
  duplicate: "Already have",
  skip: "Skipped",
  error: "Error",
};

const STATUS_VARIANTS: Record<ImportRowStatus, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  update: "secondary",
  duplicate: "outline",
  skip: "outline",
  error: "destructive",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-50";

// Remembers the column mapping per bank, keyed by the file's header row
function mappingKey(headers: string[]): string {
  return `bb-import-mapping:${headers.join("|")}`;
}

function loadSavedMapping(headers: string[]): BankMapping | undefined {
  try {
    const raw = localStorage.getItem(mappingKey(headers));
    return raw ? (JSON.parse(raw) as BankMapping) : undefined;
  } catch {
    return undefined;
  }
}

function saveMapping(headers: string[], mapping: BankMapping) {
  try {
    localStorage.setItem(mappingKey(headers), JSON.stringify(mapping));
  } catch {
    // Storage unavailable (private window): mapping just isn't remembered
  }
}

type SortKey = "line" | "date" | "amount";

/** Where to look at what an import just added */
const RESULT_LINKS: Record<ImportKind, { href: string; label: string }> = {
  bank: { href: "/receipts?source=bank&sortBy=receiptDate&sortOrder=desc", label: "View imported receipts" },
  receipts: { href: "/receipts?sortBy=receiptDate&sortOrder=desc", label: "View receipts" },
  "line-items": { href: "/receipts?sortBy=receiptDate&sortOrder=desc", label: "View receipts" },
  income: { href: "/dashboard", label: "View on dashboard" },
  recurring: { href: "/dashboard", label: "View on dashboard" },
};

function sortRows(rows: ImportRowResult[], key: SortKey, dir: "asc" | "desc"): ImportRowResult[] {
  const value = (r: ImportRowResult): string | number =>
    key === "line" ? r.line : key === "date" ? (r.date ?? "") : (r.amountCents ?? Number.NEGATIVE_INFINITY);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return -sign;
    if (va > vb) return sign;
    return a.line - b.line;
  });
}

export function ImportCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [forceBank, setForceBank] = useState(false);
  const [mapping, setMapping] = useState<BankMapping | undefined>();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ImportRowStatus | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "line", dir: "asc" });
  const [lastImport, setLastImport] = useState<{ fileName: string; kind: ImportKind; written: number; counts: ImportCounts } | null>(null);

  const visibleRows = useMemo(() => {
    if (!preview) return [];
    const filtered = statusFilter ? preview.rows.filter((r) => r.status === statusFilter) : preview.rows;
    return sortRows(filtered, sort.key, sort.dir);
  }, [preview, statusFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "line" ? "asc" : "desc" }));
  }

  async function callImport(opts: {
    text: string;
    dryRun: boolean;
    forceBank: boolean;
    mapping?: BankMapping;
    skipDuplicates: boolean;
  }): Promise<ImportResult | null> {
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: opts.text,
          kind: opts.forceBank ? "bank" : "auto",
          mapping: opts.mapping,
          dryRun: opts.dryRun,
          skipDuplicates: opts.skipDuplicates,
        }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return null;
      }
      return data;
    } catch {
      setError("Connection error. Please try again.");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshPreview(next: { forceBank?: boolean; mapping?: BankMapping; skipDuplicates?: boolean } = {}) {
    if (!file) return;
    const opts = {
      text: file.text,
      dryRun: true,
      forceBank: next.forceBank ?? forceBank,
      mapping: "mapping" in next ? next.mapping : mapping,
      skipDuplicates: next.skipDuplicates ?? skipDuplicates,
    };
    const result = await callImport(opts);
    if (result) {
      setPreview(result);
      if (result.mapping) setMapping(result.mapping);
    }
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      setError("That file is larger than 5 MB. Split it into smaller files.");
      return;
    }

    const text = await chosen.text();
    const saved = loadSavedMapping(parseCsv(text).headers);
    setFile({ name: chosen.name, text });
    setForceBank(false);
    setMapping(saved);
    setPreview(null);
    setLastImport(null);
    setStatusFilter(null);

    const result = await callImport({ text, dryRun: true, forceBank: false, mapping: saved, skipDuplicates });
    if (result) {
      setPreview(result);
      setMapping(result.mapping);
    }
  }

  function updateMapping(patch: Partial<BankMapping>) {
    if (!mapping) return;
    const next = { ...mapping, ...patch };
    // A single amount column and separate debit/credit columns are alternatives
    if (patch.amount) {
      delete next.debit;
      delete next.credit;
    }
    if (patch.amount === "") delete next.amount;
    if (patch.debit === "") delete next.debit;
    if (patch.credit === "") delete next.credit;
    setMapping(next);
    void refreshPreview({ mapping: next });
  }

  async function confirmImport() {
    if (!file || !preview) return;
    const result = await callImport({
      text: file.text,
      dryRun: false,
      forceBank,
      mapping: preview.kind === "bank" ? mapping : undefined,
      skipDuplicates,
    });
    if (!result) return;

    if (result.kind === "bank" && mapping) saveMapping(result.headers, mapping);
    toast.success(`Imported ${result.written} ${result.written === 1 ? "record" : "records"} from ${file.name}.`);
    setLastImport({ fileName: file.name, kind: result.kind, written: result.written, counts: result.counts });
    reset();
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping(undefined);
    setForceBank(false);
    setError(null);
    setStatusFilter(null);
  }

  const toWrite = preview ? preview.counts.create + preview.counts.update : 0;
  const columnOptions = preview?.headers ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          A CSV from your bank or card (each purchase becomes a receipt), or a file exported from this page. You&apos;ll
          see a preview before anything is saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChosen}
          aria-label="CSV file to import"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileInput.current?.click()} disabled={isBusy} variant={file ? "outline" : "default"}>
            <FileUp className="h-4 w-4" />
            {file ? "Choose a different file" : "Choose CSV file"}
          </Button>
          {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
          {isBusy && <span className="text-sm text-muted-foreground">Reading…</span>}
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {lastImport && !file && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">
                Imported {lastImport.written} {lastImport.written === 1 ? "record" : "records"} from {lastImport.fileName}
              </div>
              <div className="text-muted-foreground">
                {[
                  lastImport.counts.duplicate > 0 && `${lastImport.counts.duplicate} already here, not imported again`,
                  lastImport.counts.skip > 0 && `${lastImport.counts.skip} skipped`,
                  lastImport.counts.error > 0 && `${lastImport.counts.error} with errors`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Nothing was skipped."}
              </div>
            </div>
            <Link href={RESULT_LINKS[lastImport.kind].href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {RESULT_LINKS[lastImport.kind].label}
            </Link>
          </div>
        )}

        {preview && file && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{KIND_LABELS[preview.kind]}</span>
              <span className="text-muted-foreground">· {preview.totalRows} rows</span>
              {preview.kind !== "bank" && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  disabled={isBusy}
                  onClick={() => {
                    setForceBank(true);
                    void refreshPreview({ forceBank: true, mapping: undefined });
                  }}
                >
                  Not right? Treat as a bank statement
                </Button>
              )}
            </div>

            {preview.kind === "bank" && mapping && (
              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <ColumnSelect label="Date column" value={mapping.date} options={columnOptions} disabled={isBusy}
                  onChange={(v) => updateMapping({ date: v })} />
                <ColumnSelect label="Description column" value={mapping.description} options={columnOptions} disabled={isBusy}
                  onChange={(v) => updateMapping({ description: v })} />
                <ColumnSelect label="Amount column" value={mapping.amount ?? ""} options={columnOptions} disabled={isBusy}
                  emptyLabel="Separate debit/credit columns" onChange={(v) => updateMapping({ amount: v })} />
                {mapping.amount ? (
                  <div className="space-y-1">
                    <Label htmlFor="spendingIs">Purchases are</Label>
                    <select id="spendingIs" className={selectClass} value={mapping.spendingIs} disabled={isBusy}
                      onChange={(e) => updateMapping({ spendingIs: e.target.value as BankMapping["spendingIs"] })}>
                      <option value="negative">Negative (-12.50)</option>
                      <option value="positive">Positive (12.50)</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <ColumnSelect label="Debit (money out)" value={mapping.debit ?? ""} options={columnOptions} disabled={isBusy}
                      emptyLabel="Choose…" onChange={(v) => updateMapping({ debit: v })} />
                    <ColumnSelect label="Credit (money in)" value={mapping.credit ?? ""} options={columnOptions} disabled={isBusy}
                      emptyLabel="None" onChange={(v) => updateMapping({ credit: v })} />
                  </>
                )}
                <div className="space-y-1">
                  <Label htmlFor="dateFormat">Date format</Label>
                  <select id="dateFormat" className={selectClass} value={mapping.dateFormat} disabled={isBusy}
                    onChange={(e) => updateMapping({ dateFormat: e.target.value as BankMapping["dateFormat"] })}>
                    <option value="auto">Detect</option>
                    <option value="mdy">Month first (03/14/2026)</option>
                    <option value="dmy">Day first (14/03/2026)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(STATUS_LABELS) as ImportRowStatus[])
                .filter((s) => preview.counts[s] > 0)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter((f) => (f === s ? null : s))}
                    aria-pressed={statusFilter === s}
                    title={statusFilter === s ? "Show all rows" : `Show only "${STATUS_LABELS[s]}" rows`}
                    className={cn("rounded-4xl", statusFilter === s && "ring-2 ring-ring")}
                  >
                    <Badge variant={STATUS_VARIANTS[s]}>
                      {preview.counts[s]} {STATUS_LABELS[s].toLowerCase()}
                    </Badge>
                  </button>
                ))}
              {statusFilter && (
                <Button variant="link" size="sm" className="px-0" onClick={() => setStatusFilter(null)}>
                  Show all
                </Button>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  disabled={isBusy}
                  onChange={(e) => {
                    setSkipDuplicates(e.target.checked);
                    void refreshPreview({ skipDuplicates: e.target.checked });
                  }}
                />
                Skip ones I already have
              </label>
            </div>

            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Line" sortKey="line" sort={sort} onSort={toggleSort} className="w-16" />
                    <TableHead className="w-28">Result</TableHead>
                    <SortableHead label="Date" sortKey="date" sort={sort} onSort={toggleSort} className="w-28" />
                    <TableHead>Description</TableHead>
                    <SortableHead label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} className="w-28 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.line}>
                      <TableCell className="tabular-nums text-muted-foreground">{row.line}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{row.date ?? "—"}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="text-sm">{row.description || row.summary || "—"}</div>
                        {row.message && (
                          <div className={cn("text-xs", row.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                            {row.message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {row.amountCents !== undefined ? formatCurrency(row.amountCents) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {visibleRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No rows match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {preview.rows.length < preview.totalRows && (
              <p className="text-xs text-muted-foreground">
                Showing {preview.rows.length} of {preview.totalRows} rows: every problem row, plus a sample of the rest.
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={confirmImport} disabled={isBusy || toWrite === 0}>
                {isBusy ? "Working…" : toWrite === 0 ? "Nothing to import" : `Import ${toWrite} ${toWrite === 1 ? "row" : "rows"}`}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={isBusy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  emptyLabel = "Choose…",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled: boolean;
  emptyLabel?: string;
}) {
  const id = `col-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={selectClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 font-medium", className?.includes("text-right") && "flex-row-reverse")}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "text-primary" : "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}
