"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatBlock } from "@/components/dashboard/StatBlock";
import { SpendAreaChart } from "@/components/dashboard/SpendAreaChart";
import { TopStoresChart } from "@/components/dashboard/CategoryPieChart";
import { TopStoresListBlock } from "@/components/dashboard/TopStoresListBlock";
import { RecentReceiptsBlock } from "@/components/dashboard/RecentReceiptsBlock";
import { RecurringCostsBlock } from "@/components/dashboard/RecurringCostsBlock";
import { IncomeSourcesBlock } from "@/components/dashboard/IncomeSourcesBlock";
import { LeftOverBlock } from "@/components/dashboard/LeftOverBlock";
import { TakeawaysCard } from "@/components/insights/TakeawaysCard";
import { MonthGlanceDialog } from "@/components/insights/MonthGlanceDialog";
import { MoneyFlowDialog } from "@/components/insights/ExplainDialogs";
import { useInsights } from "@/hooks/useInsights";
import type { InsightAction } from "@/types/insights";
import { useStats } from "@/hooks/useStats";
import { useRecurring } from "@/hooks/useRecurring";
import { useIncome } from "@/hooks/useIncome";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function HomepageClient() {
  const { data, isLoading } = useStats();
  const { summary: recurringSummary, isLoading: recurringLoading } = useRecurring();
  const { summary: incomeSummary, isLoading: incomeLoading } = useIncome();
  const { report, isLoading: insightsLoading } = useInsights();
  const router = useRouter();
  const [glanceOpen, setGlanceOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  // Takeaways on the dashboard hand off to the Insights page for anything deeper
  function handleInsightAction(action: InsightAction) {
    if (action.type === "review") router.push("/receipts");
    else router.push("/insights");
  }

  const summary = data?.summary;
  const dailySpend = data?.dailySpend ?? [];
  const topStores = data?.topStores ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{getGreeting()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{getFormattedDate()}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Here&apos;s your spending overview.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/receipts" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/upload" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <Upload className="h-3.5 w-3.5" />
            Upload Receipt
          </Link>
        </div>
      </div>

      {/* Spending Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock title="Today" value={summary?.today ?? 0} isLoading={isLoading} />
        <StatBlock title="This Week" value={summary?.week ?? 0} isLoading={isLoading} />
        <StatBlock
          title="This Month"
          value={summary?.month ?? 0}
          previousValue={report?.pace?.sameDayLastMonth}
          trendLabel="than this point last month"
          isLoading={isLoading}
          onClick={() => setGlanceOpen(true)}
        />
        <StatBlock title="This Year" value={summary?.year ?? 0} isLoading={isLoading} />
      </div>

      {/* Financial Health Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBlock title="Monthly Recurring" value={recurringSummary?.monthlyTotal ?? 0} isLoading={recurringLoading} />
        <StatBlock title="Monthly Income" value={incomeSummary?.monthlyTotal ?? 0} isLoading={incomeLoading} />
        <LeftOverBlock money={report?.money} isLoading={insightsLoading} onClick={() => setFlowOpen(true)} />
      </div>

      {/* Plain-language takeaways for this month */}
      {report && report.insights.length > 0 && (
        <TakeawaysCard
          title="This month so far"
          insights={report.insights}
          limit={3}
          onAction={handleInsightAction}
          footer={
            <Link href="/insights" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
              See all insights <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Spend trend — takes 2/3 of the row */}
        <div className="lg:col-span-2">
          <SpendAreaChart data={dailySpend} isLoading={isLoading} />
        </div>

        {/* Top stores — takes 1/3 */}
        <div className="flex flex-col gap-4">
          <div className="flex-1">
            <TopStoresChart stores={topStores} isLoading={isLoading} />
          </div>
          <div className="flex-1">
            <TopStoresListBlock stores={topStores} isLoading={isLoading} />
          </div>
        </div>
      </div>

      {/* Recent Receipts */}
      <div>
        <RecentReceiptsBlock />
      </div>

      {/* Recurring Costs */}
      <div>
        <RecurringCostsBlock />
      </div>

      {/* Income */}
      <div>
        <IncomeSourcesBlock />
      </div>

      <MonthGlanceDialog report={report} open={glanceOpen} onOpenChange={setGlanceOpen} />
      {report && <MoneyFlowDialog open={flowOpen} onOpenChange={setFlowOpen} report={report} />}
    </div>
  );
}
