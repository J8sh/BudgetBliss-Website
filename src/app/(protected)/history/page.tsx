import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryClient } from "@/components/history/HistoryClient";

export const metadata: Metadata = {
  title: "History — BudgetBliss",
};

export default function HistoryPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Spending History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter receipts and view aggregated stats for any time period.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" />}>
        <HistoryClient />
      </Suspense>
    </div>
  );
}
