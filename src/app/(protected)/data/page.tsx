import type { Metadata } from "next";
import { ExportCard } from "@/components/data/ExportCard";
import { ImportCard } from "@/components/data/ImportCard";

export const metadata: Metadata = {
  title: "Import & Export — BudgetBliss",
};

export default function DataPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Import &amp; Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download your data as CSV, or bring in a bank statement or a BudgetBliss export.
        </p>
      </div>
      <div className="max-w-4xl space-y-6">
        <ExportCard />
        <ImportCard />
      </div>
    </div>
  );
}
