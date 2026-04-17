import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminClient } from "@/components/admin/AdminClient";

export const metadata: Metadata = {
  title: "Admin — BudgetBliss",
};

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage receipts, re-analyze images, and monitor extraction quality.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" />}>
        <AdminClient />
      </Suspense>
    </div>
  );
}
