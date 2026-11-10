"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardHelpLink } from "./CardHelpLink";
import { formatWholeDollars } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { InsightsReport } from "@/types/insights";

interface MoneyFlowCardProps {
  report: InsightsReport;
  onExplain: () => void;
}

const SEGMENTS = [
  { key: "fixed", label: "Recurring bills", swatch: "bg-viz-1" },
  { key: "flexible", label: "Day-to-day spending", swatch: "bg-viz-2" },
  { key: "leftOver", label: "Left over", swatch: "bg-viz-3" },
] as const;

/**
 * Where income went this month, as figures with a thin segmented bar under them
 * (the figures carry the numbers; the bar shows the proportions at a glance).
 */
export function MoneyFlowCard({ report, onExplain }: MoneyFlowCardProps) {
  const { money } = report;
  const hasIncome = money.income > 0;
  const overspent = money.leftOver < 0;

  // The bar's whole is income, or total spending when spending is bigger
  const whole = Math.max(money.income, money.fixed + money.flexible);
  const widths = {
    fixed: whole > 0 ? money.fixed / whole : 0,
    flexible: whole > 0 ? money.flexible / whole : 0,
    leftOver: whole > 0 && !overspent ? money.leftOver / whole : 0,
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Money in and out</CardTitle>
        <CardHelpLink onClick={onExplain}>How these numbers work</CardHelpLink>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Income</dt>
            <dd className="text-xl font-semibold tabular-nums">{hasIncome ? formatWholeDollars(money.income) : "—"}</dd>
          </div>
          {SEGMENTS.map((s) => {
            const value = money[s.key];
            return (
              <div key={s.key}>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", s.swatch)} aria-hidden />
                  {s.label}
                </dt>
                <dd className={cn("text-xl font-semibold tabular-nums", s.key === "leftOver" && overspent && "text-destructive")}>
                  {s.key === "leftOver" && !hasIncome ? "—" : formatWholeDollars(value)}
                </dd>
              </div>
            );
          })}
        </dl>

        {whole > 0 && (
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {SEGMENTS.map((s) =>
              widths[s.key] > 0 ? (
                <div key={s.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", s.swatch)} style={{ width: `${widths[s.key] * 100}%` }} />
              ) : null,
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {!hasIncome
            ? "Add your income on the dashboard to see what's left over each month."
            : overspent
              ? `Spending was ${formatWholeDollars(-money.leftOver)} more than income${report.isCurrentMonth ? " so far this month" : ""}.`
              : `${Math.round((money.savingsRate ?? 0) * 100)}% of income ${report.isCurrentMonth ? "is still unspent" : "was left over"}${
                  report.isCurrentMonth ? `, with ${report.daysInMonth - report.daysElapsed} days to go` : ""
                }.`}
        </p>
      </CardContent>
    </Card>
  );
}
