import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceiptsClient } from "@/components/receipts/ReceiptsClient";

export const metadata: Metadata = {
  title: "Receipts — BudgetBliss",
};

export default function ReceiptsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Receipts</h1>
      <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" />}>
        <ReceiptsClient />
      </Suspense>
    </div>
  );
}
