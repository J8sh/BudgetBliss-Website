import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightsClient } from "@/components/insights/InsightsClient";

export const metadata: Metadata = {
  title: "Insights — BudgetBliss",
};

export default function InsightsPage() {
  return (
    // Suspense required because InsightsClient uses useSearchParams()
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <InsightsClient />
    </Suspense>
  );
}
