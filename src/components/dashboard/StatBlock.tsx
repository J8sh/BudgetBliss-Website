"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface StatBlockProps {
  title: string;
  /** Amount in cents */
  value: number;
  /** Amount in cents — used to compute trend */
  previousValue?: number;
  isLoading?: boolean;
  /** CSS classes for the drag handle */
  dragHandleClassName?: string;
}

export function StatBlock({
  title,
  value,
  previousValue,
  isLoading,
  dragHandleClassName,
}: StatBlockProps) {
  const trend =
    previousValue != null
      ? previousValue === 0
        ? 0
        : ((value - previousValue) / previousValue) * 100
      : null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className={cn("pb-2 shrink-0", dragHandleClassName)}>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-16 rounded-md bg-muted animate-pulse" />
          </div>
        ) : (
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(value)}</p>
            {trend !== null && (
              <div
                className={cn(
                  "flex items-center gap-1 mt-1 text-xs font-medium",
                  trend > 0
                    ? "text-destructive"
                    : trend < 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground",
                )}
              >
                {trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span>
                  {trend === 0
                    ? "No change"
                    : `${Math.abs(trend).toFixed(1)}% ${trend > 0 ? "more" : "less"} than last period`}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
