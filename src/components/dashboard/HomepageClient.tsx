"use client";

import Link from "next/link";
import { Upload, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatBlock } from "@/components/dashboard/StatBlock";
import { SpendAreaChart } from "@/components/dashboard/SpendAreaChart";
import { TopStoresChart } from "@/components/dashboard/CategoryPieChart";
import { TopStoresListBlock } from "@/components/dashboard/TopStoresListBlock";
import { RecentReceiptsBlock } from "@/components/dashboard/RecentReceiptsBlock";
import { useStats } from "@/hooks/useStats";

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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock title="Today" value={summary?.today ?? 0} isLoading={isLoading} />
        <StatBlock title="This Week" value={summary?.week ?? 0} isLoading={isLoading} />
        <StatBlock title="This Month" value={summary?.month ?? 0} isLoading={isLoading} />
        <StatBlock title="This Year" value={summary?.year ?? 0} isLoading={isLoading} />
      </div>

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
    </div>
  );
}
