"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInsights } from "@/hooks/useInsights";
import { addMonths, monthLabel } from "@/lib/finance/insights";
import { localDateString } from "@/lib/utils/dates";
import { formatWholeDollars } from "@/lib/utils/currency";
import type { CategoryKey } from "@/lib/finance/categories";
import type { InsightAction } from "@/types/insights";
import { TakeawaysCard } from "./TakeawaysCard";
import { MoneyFlowCard } from "./MoneyFlowCard";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard";
import { BudgetRuleCard } from "./BudgetRuleCard";
import { HabitsCard } from "./HabitsCard";
import { MonthlyBarsChart } from "./MonthlyBarsChart";
import { CategoryDialog } from "./CategoryDialog";
import { CategorizeDialog } from "./CategorizeDialog";
import { BudgetRuleDialog, MoneyFlowDialog } from "./ExplainDialogs";

const selectClass = "h-8 rounded-lg border border-input bg-background px-2 text-sm font-medium text-foreground";

export function InsightsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const thisMonth = localDateString().slice(0, 7);
  const requested = searchParams.get("month");
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : thisMonth;

  const { report, isLoading, error, refetch } = useInsights(month);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [categorizeOpen, setCategorizeOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  function goTo(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === thisMonth) params.delete("month");
    else params.set("month", next);
    const query = params.toString();
    router.replace(query ? `/insights?${query}` : "/insights", { scroll: false });
  }

  function handleAction(action: InsightAction) {
    switch (action.type) {
      case "category":
        setCategory(action.key);
        break;
      case "categorize":
        setCategorizeOpen(true);
        break;
      case "budget-rule":
        setRuleOpen(true);
        break;
      case "review":
        router.push(`/receipts?dateFrom=${month}-01&dateTo=${month}-${String(report?.daysInMonth ?? 28).padStart(2, "0")}`);
        break;
    }
  }

  const months = Array.from(new Set([thisMonth, month, ...(report?.availableMonths ?? [])])).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Where your money goes, in plain language.</p>
        </div>
        <div className="flex items-center gap-1" aria-label="Choose a month">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goTo(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select className={selectClass} value={month} onChange={(e) => goTo(e.target.value)} aria-label="Month">
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {m === thisMonth ? " (this month)" : ""}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => goTo(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&apos;t load insights. <button className="underline" onClick={refetch}>Try again</button>
        </div>
      )}

      {isLoading && !report ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-3" />
          <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
          <div className="h-40 animate-pulse rounded-xl bg-muted lg:col-span-5" />
        </div>
      ) : report ? (
        <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isLoading}>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TakeawaysCard insights={report.insights} onAction={handleAction} />
            </div>
            <div className="lg:col-span-2">
              <BudgetRuleCard split={report.split} isCurrentMonth={report.isCurrentMonth} onExplain={() => setRuleOpen(true)} />
            </div>

            <div className="lg:col-span-5">
              <MoneyFlowCard report={report} onExplain={() => setFlowOpen(true)} />
            </div>

            <div className="lg:col-span-3">
              <CategoryBreakdownCard categories={report.categories} onSelect={setCategory} onCategorize={() => setCategorizeOpen(true)} />
            </div>
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Day-to-day spending by month</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {report.change.average !== null
                      ? `Recent average: ${formatWholeDollars(report.change.average)} a month. Click a month to see it.`
                      : "Click a month to see it."}
                  </p>
                </CardHeader>
                <CardContent>
                  <MonthlyBarsChart
                    data={report.trend.map((t) => ({ month: t.month, label: t.label.slice(0, 1), value: t.flexible }))}
                    highlight={report.month}
                    average={report.change.average}
                    onSelect={goTo}
                    ariaLabel={`Day-to-day spending for the 12 months ending ${report.label}`}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5">
              <HabitsCard habits={report.habits} />
            </div>
          </div>

          <CategoryDialog
            report={report}
            categoryKey={category}
            onClose={() => setCategory(null)}
            onCategorize={() => {
              setCategory(null);
              setCategorizeOpen(true);
            }}
          />
          <MoneyFlowDialog open={flowOpen} onOpenChange={setFlowOpen} report={report} />
        </div>
      ) : null}

      <BudgetRuleDialog open={ruleOpen} onOpenChange={setRuleOpen} />
      <CategorizeDialog open={categorizeOpen} onOpenChange={setCategorizeOpen} onChanged={refetch} />
    </div>
  );
}
