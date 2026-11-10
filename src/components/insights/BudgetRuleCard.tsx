"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardHelpLink } from "./CardHelpLink";
import { formatWholeDollars } from "@/lib/utils/currency";
import type { BudgetSplit } from "@/types/insights";

interface BudgetRuleCardProps {
  split: BudgetSplit;
  isCurrentMonth: boolean;
  onExplain: () => void;
}

interface Row {
  label: string;
  amount: number;
  share: number | null;
  target: number;
  /** Needs and wants should stay under their target; savings should reach it */
  goal: "under" | "over";
}

/**
 * The 50/30/20 check as a meter list: one bar per bucket against its own target line,
 * with the verdict in words and an icon (never color alone).
 */
export function BudgetRuleCard({ split, isCurrentMonth, onExplain }: BudgetRuleCardProps) {
  const rows: Row[] = [
    { label: "Needs", amount: split.needs, share: split.needsShare, target: 0.5, goal: "under" },
    { label: "Wants", amount: split.wants, share: split.wantsShare, target: 0.3, goal: "under" },
    { label: "Saved", amount: split.savings, share: split.savingsShare, target: 0.2, goal: "over" },
  ];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Needs, wants &amp; savings</CardTitle>
        <CardHelpLink onClick={onExplain}>How the 50/30/20 rule works</CardHelpLink>
      </CardHeader>
      <CardContent className="space-y-4">
        {split.income <= 0 ? (
          <p className="text-sm text-muted-foreground">
            Add your income on the dashboard to compare your spending with the 50/30/20 guideline.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {rows.map((row) => {
                const share = Math.max(0, row.share ?? 0);
                const ok = row.goal === "under" ? share <= row.target : share >= row.target;
                const Icon = ok ? CircleCheck : CircleAlert;
                const verdict = ok ? "on track" : row.goal === "under" ? "above it" : "below it";
                return (
                  <li key={row.label} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums">
                        <span className="font-semibold">{Math.round((row.share ?? 0) * 100)}%</span>
                        <span className="text-muted-foreground"> · {formatWholeDollars(row.amount)}</span>
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-viz-1" style={{ width: `${Math.min(1, share) * 100}%` }} />
                      <div
                        className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground"
                        style={{ left: `calc(${row.target * 100}% - 1px)` }}
                        aria-hidden
                      />
                    </div>
                    <p className={`flex items-center gap-1 text-xs ${ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
                      <Icon className="h-3 w-3" aria-hidden />
                      Guideline {row.goal === "under" ? "at most" : "at least"} {row.target * 100}% · {verdict}
                    </p>
                  </li>
                );
              })}
            </ul>
            {split.unsorted > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatWholeDollars(split.unsorted)} isn&apos;t sorted into a category yet, so it isn&apos;t counted as a need or a want.
              </p>
            )}
            {isCurrentMonth && (
              <p className="text-xs text-muted-foreground">The month isn&apos;t over, so &quot;saved&quot; is what hasn&apos;t been spent yet.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
