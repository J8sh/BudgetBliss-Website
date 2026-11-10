"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/finance/categories";
import { formatWholeDollars } from "@/lib/utils/currency";
import type { InsightsReport } from "@/types/insights";

interface ExplainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** What the 50/30/20 rule is, which categories count as needs vs wants, and its limits */
export function BudgetRuleDialog({ open, onOpenChange }: ExplainDialogProps) {
  const needs = CATEGORY_IDS.filter((id) => CATEGORIES[id].kind === "need").map((id) => CATEGORIES[id].label);
  const wants = CATEGORY_IDS.filter((id) => CATEGORIES[id].kind === "want").map((id) => CATEGORIES[id].label);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>The 50/30/20 rule</DialogTitle>
          <DialogDescription>A simple way to check whether spending leaves room for the future.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>Split your take-home pay into three parts:</p>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium">50% or less on needs</dt>
              <dd className="text-muted-foreground">What you&apos;d have to pay even in a lean month: {needs.join(", ").toLowerCase()}.</dd>
            </div>
            <div>
              <dt className="font-medium">30% or less on wants</dt>
              <dd className="text-muted-foreground">What makes life better but could be cut back: {wants.join(", ").toLowerCase()}.</dd>
            </div>
            <div>
              <dt className="font-medium">20% or more to savings</dt>
              <dd className="text-muted-foreground">
                An emergency fund, retirement, paying debt down faster, or goals like a car or a trip. Here it&apos;s whatever
                is left after needs and wants.
              </dd>
            </div>
          </dl>
          <p className="rounded-md bg-muted px-3 py-2">
            It&apos;s a rule of thumb, not a grade. Rent in an expensive city or a lower income can push needs past 50%, and
            that&apos;s normal. What helps most is watching the direction month to month.
          </p>
          <p className="text-muted-foreground">
            A category&apos;s need/want label comes from the list above. If a store is in the wrong category, use &quot;Sort
            stores&quot; to move it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** How the money-in/out numbers are calculated, with this month's actual figures */
export function MoneyFlowDialog({ open, onOpenChange, report }: ExplainDialogProps & { report: InsightsReport }) {
  const { money } = report;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How these numbers work</DialogTitle>
          <DialogDescription>{report.label}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <table className="w-full tabular-nums">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-1.5">Income</td>
                <td className="py-1.5 text-right">{formatWholeDollars(money.income)}</td>
              </tr>
              <tr>
                <td className="py-1.5">− Recurring bills</td>
                <td className="py-1.5 text-right">{formatWholeDollars(money.fixed)}</td>
              </tr>
              <tr>
                <td className="py-1.5">− Day-to-day spending</td>
                <td className="py-1.5 text-right">{formatWholeDollars(money.flexible)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1.5">= Left over</td>
                <td className="py-1.5 text-right">{formatWholeDollars(money.leftOver)}</td>
              </tr>
            </tbody>
          </table>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium">Income and recurring bills</dt>
              <dd className="text-muted-foreground">
                Come from the lists on your dashboard, converted to a monthly amount (a weekly paycheck counts 52 ÷ 12 times).
                Only active entries count, and the current list is used for every month, so update it when something changes.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Day-to-day spending</dt>
              <dd className="text-muted-foreground">
                Every receipt dated this month, whether photographed, typed in or imported from a statement.
                {report.coverage.matchedToFixed > 0 &&
                  ` ${report.coverage.matchedToFixed} imported bank charge${report.coverage.matchedToFixed === 1 ? " matches" : "es match"} a recurring bill's amount, so ${report.coverage.matchedToFixed === 1 ? "it's" : "they're"} counted once, as the bill.`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Left over</dt>
              <dd className="text-muted-foreground">
                What remains for savings and goals. Purchases you didn&apos;t record (cash, online orders without a receipt) aren&apos;t
                included, so the real number is usually a little lower. Importing your bank statement each month closes that gap.
              </dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
