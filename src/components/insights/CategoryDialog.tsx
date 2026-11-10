"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatWholeDollars } from "@/lib/utils/currency";
import { CATEGORIES, type CategoryKey } from "@/lib/finance/categories";
import { MonthlyBarsChart } from "@/components/insights/MonthlyBarsChart";
import type { InsightsReport } from "@/types/insights";

interface CategoryDialogProps {
  report: InsightsReport;
  categoryKey: CategoryKey | null;
  onClose: () => void;
  onCategorize: () => void;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** One category up close: how it compares, its history, and which stores and purchases make it up */
export function CategoryDialog({ report, categoryKey, onClose, onCategorize }: CategoryDialogProps) {
  const category = report.categories.find((c) => c.key === categoryKey);
  const info = categoryKey && categoryKey !== "uncategorized" ? CATEGORIES[categoryKey] : null;

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {category && (
          <>
            <DialogHeader>
              <DialogTitle>{category.label}</DialogTitle>
              <DialogDescription>
                {info
                  ? `${info.examples}. Counted as a ${info.kind} in the needs / wants / savings check.`
                  : "Spending at stores that haven't been given a category yet."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3">
              <Stat label={report.label.split(" ")[0]!} value={formatWholeDollars(category.total)} sub={`${Math.round(category.share * 100)}% of spending`} />
              <Stat label={report.change.previousLabel.split(" ")[0]!} value={formatWholeDollars(category.previous)} />
              <Stat label="Usual month" value={category.average === null ? "—" : formatWholeDollars(category.average)} sub="Average of earlier months" />
            </div>

            {category.fixed > 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {formatWholeDollars(category.fixed)} comes from recurring bills and {formatWholeDollars(category.flexible)} from receipts.
              </p>
            )}

            <section>
              <h3 className="mb-1 text-sm font-medium">Last 12 months</h3>
              <MonthlyBarsChart
                data={report.trend.map((t, i) => ({ month: t.month, label: t.label.slice(0, 1), value: category.history[i] ?? 0 }))}
                highlight={report.month}
                average={category.average}
                height={140}
                ariaLabel={`${category.label} by month for the last 12 months`}
              />
            </section>

            {category.topMerchants.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-medium">Stores</h3>
                <ul className="divide-y divide-border text-sm">
                  {category.topMerchants.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {m.visits} {m.visits === 1 ? "visit" : "visits"} · <span className="text-foreground">{formatCurrency(m.total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {category.largest.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-medium">Biggest purchases</h3>
                <ul className="divide-y divide-border text-sm">
                  {category.largest.map((p) => (
                    <li key={`${p.receiptId}-${p.amount}`}>
                      <Link
                        href={`/receipts/${p.receiptId}`}
                        className="flex items-center justify-between gap-3 rounded py-1.5 hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {p.storeName} <span className="text-muted-foreground">· {p.date}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(p.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onCategorize}>
                Change a store&apos;s category
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
