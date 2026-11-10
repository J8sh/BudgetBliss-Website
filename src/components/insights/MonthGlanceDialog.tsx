"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatWholeDollars } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { InsightsReport } from "@/types/insights";

interface MonthGlanceDialogProps {
  report: InsightsReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Why is this month's number what it is?": pace, and the categories it's made of */
export function MonthGlanceDialog({ report, open, onOpenChange }: MonthGlanceDialogProps) {
  const flexibleCategories = report?.categories.filter((c) => c.flexible > 0).sort((a, b) => b.flexible - a.flexible) ?? [];
  const top = flexibleCategories.slice(0, 5);
  const rest = flexibleCategories.slice(5).reduce((s, c) => s + c.flexible, 0);
  const max = Math.max(1, ...top.map((c) => c.flexible));
  const pace = report?.pace;

  return (
    <Dialog open={open && !!report} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {report && (
          <>
            <DialogHeader>
              <DialogTitle>{report.label.split(" ")[0]} so far</DialogTitle>
              <DialogDescription>
                Day-to-day purchases from your receipts. Recurring bills are counted separately.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums">{formatWholeDollars(report.money.flexible)}</p>
              {pace && (
                <p className="text-sm text-muted-foreground">
                  {formatWholeDollars(pace.sameDayLastMonth)} by day {report.daysElapsed} last month
                  {pace.projected !== null ? `. On pace for about ${formatWholeDollars(pace.projected)}` : ""}
                  {pace.lastMonthTotal > 0 ? ` (last month: ${formatWholeDollars(pace.lastMonthTotal)})` : ""}.
                </p>
              )}
            </div>

            {top.length > 0 ? (
              <ul className="space-y-2.5">
                {top.map((c) => (
                  <li key={c.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{c.label}</span>
                      <span className="font-medium tabular-nums">{formatWholeDollars(c.flexible)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", c.key === "uncategorized" ? "bg-viz-muted" : "bg-viz-1")}
                        style={{ width: `${(c.flexible / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
                {rest > 0 && (
                  <li className="flex justify-between text-sm text-muted-foreground">
                    <span>Everything else</span>
                    <span className="tabular-nums">{formatWholeDollars(rest)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No receipts yet this month.</p>
            )}

            <Link href="/insights" className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5")}>
              See the full breakdown
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
