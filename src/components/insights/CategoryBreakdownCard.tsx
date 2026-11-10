"use client";

import { ChevronRight, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardHelpLink } from "./CardHelpLink";
import { formatWholeDollars } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CategoryKey } from "@/lib/finance/categories";
import type { CategoryTotal } from "@/types/insights";

interface CategoryBreakdownCardProps {
  categories: CategoryTotal[];
  onSelect: (key: CategoryKey) => void;
  onCategorize: () => void;
}

/** Change against the recent average, in words a glance can take in */
function vsAverage(c: CategoryTotal): { text: string; className: string } | null {
  if (c.average === null || c.average === 0) return null;
  const diff = c.total - c.average;
  if (Math.abs(diff) < Math.max(1000, c.average * 0.1)) return { text: "about usual", className: "text-muted-foreground" };
  return {
    text: `${diff > 0 ? "+" : "−"}${formatWholeDollars(Math.abs(diff))} vs usual`,
    className: diff > 0 ? "text-foreground" : "text-muted-foreground",
  };
}

/**
 * Where the money went: ranked horizontal bars on one baseline (one hue; the bars compare,
 * the text carries the numbers). Each row opens the category's details.
 */
export function CategoryBreakdownCard({ categories, onSelect, onCategorize }: CategoryBreakdownCardProps) {
  const shown = categories.filter((c) => c.total > 0);
  const max = Math.max(1, ...shown.map((c) => c.total));

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Where it went</CardTitle>
        <CardHelpLink onClick={onCategorize} icon={Tags}>
          Sort stores into categories
        </CardHelpLink>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spending recorded this month.</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {shown.map((c) => {
              const change = vsAverage(c);
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.key)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.kind === "need" ? "Need" : c.kind === "want" ? "Want" : "Needs sorting"}
                        {c.fixed > 0 && " · includes bills"}
                      </span>
                    </span>
                    <span className="col-span-2 row-start-2 h-2 rounded-full bg-muted sm:col-span-1 sm:row-start-auto">
                      <span
                        className={cn("block h-full rounded-full", c.key === "uncategorized" ? "bg-viz-muted" : "bg-viz-1")}
                        style={{ width: `${(c.total / max) * 100}%` }}
                      />
                    </span>
                    <span className="flex items-center gap-1 text-right">
                      <span>
                        <span className="block text-sm font-semibold tabular-nums">{formatWholeDollars(c.total)}</span>
                        <span className={cn("block text-xs tabular-nums", change?.className ?? "text-muted-foreground")}>
                          {change?.text ?? `${Math.round(c.share * 100)}%`}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
