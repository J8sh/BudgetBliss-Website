"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatBlock } from "@/components/dashboard/StatBlock";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
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
import type { StatRange } from "@/types/stats";
import { STAT_RANGES } from "@/lib/finance/stats";
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

const RANGE_KEY = "bb-dashboard-range";
const RANGE_EVENT = "bb-dashboard-range-change";

/** Used when the browser blocks storage (some private windows), so the buttons still work */
let rangeInMemory: StatRange | null = null;

function readSavedRange(): StatRange {
  try {
    const saved = localStorage.getItem(RANGE_KEY);
    if (saved && saved in STAT_RANGES) return saved as StatRange;
  } catch {
    // Storage unavailable: fall through to memory
  }
  return rangeInMemory ?? "30d";
}

function subscribeToRange(onChange: () => void) {
  window.addEventListener(RANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(RANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The chart range, remembered on this device (server render uses the default) */
function useSavedRange(): [StatRange, (r: StatRange) => void] {
  const range = useSyncExternalStore(subscribeToRange, readSavedRange, () => "30d" as StatRange);
  function update(r: StatRange) {
    rangeInMemory = r;
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      // Not remembered across visits
    }
    window.dispatchEvent(new Event(RANGE_EVENT));
  }
  return [range, update];
}

const SPENDING_NOTE = "Only day-to-day spending: recurring bills and transfers like credit card payments aren't included.";

export function HomepageClient() {
  const [range, setRange] = useSavedRange();
  const { data, isLoading } = useStats(range);
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
        <StatBlock
          title="Today"
          value={summary?.today ?? 0}
          isLoading={isLoading && !summary}
          info={<>What you&apos;ve spent today. {SPENDING_NOTE}</>}
        />
        <StatBlock
          title="This Week"
          value={summary?.week ?? 0}
          isLoading={isLoading && !summary}
          info={<>Spending since Sunday. {SPENDING_NOTE}</>}
        />
        <StatBlock
          title="This Month"
          value={summary?.month ?? 0}
          previousValue={report?.pace?.sameDayLastMonth}
          trendLabel="than this point last month"
          isLoading={isLoading && !summary}
          onClick={() => setGlanceOpen(true)}
          info={
            <>
              Spending since the 1st, compared with the same day last month. {SPENDING_NOTE} Click the card for the
              breakdown by category.
            </>
          }
        />
        <StatBlock
          title="This Year"
          value={summary?.year ?? 0}
          isLoading={isLoading && !summary}
          info={
            <>
              Spending since January 1. {SPENDING_NOTE} Your bills are on top of this: see Monthly Recurring, or the
              Insights page for the full picture.
            </>
          }
        />
      </div>

      {/* Financial Health Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBlock
          title="Monthly Recurring"
          value={recurringSummary?.monthlyTotal ?? 0}
          isLoading={recurringLoading}
          info="Your recurring bills (rent, utilities, subscriptions) added up as a monthly amount. Yearly or weekly bills are converted. Edit them in Recurring Costs below."
        />
        <StatBlock
          title="Monthly Income"
          value={incomeSummary?.monthlyTotal ?? 0}
          isLoading={incomeLoading}
          info="Your income sources added up as a monthly amount, from Income Sources below. Use take-home pay (after taxes) so the other numbers match what reaches your bank."
        />
        <LeftOverBlock money={report?.money} isLoading={insightsLoading} onClick={() => setFlowOpen(true)} />
      </div>

      {/* Plain-language takeaways for this month */}
      {report && report.insights.length > 0 && (
        <TakeawaysCard
          title="This month so far"
          info="A few plain-language observations about this month: how your spending compares, where most of it went, and anything worth a look. Insights has the full review."
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
      {/* Charts row: both follow the chart's range; the chart stretches to the row's height */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpendingChart series={data?.series} range={range} onRangeChange={setRange} isLoading={isLoading} />
        </div>
        <div>
          <TopStoresListBlock
            stores={topStores}
            isLoading={isLoading}
            title={`Top stores, last ${STAT_RANGES[range].label}`}
            limit={8}
          />
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
