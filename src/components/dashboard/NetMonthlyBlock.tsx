"use client";

import { Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface NetMonthlyBlockProps {
  incomeMonthly: number; // cents
  recurringMonthly: number; // cents
  isLoading?: boolean;
  dragHandleClassName?: string;
}

export function NetMonthlyBlock({
  incomeMonthly,
  recurringMonthly,
  isLoading,
  dragHandleClassName,
}: NetMonthlyBlockProps) {
  const net = incomeMonthly - recurringMonthly;
  const isSurplus = net >= 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className={cn("pb-2 shrink-0", dragHandleClassName)}>
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Monthly</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        ) : (
          <div>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums leading-tight",
                isSurplus ? "text-green-600 dark:text-green-400" : "text-destructive",
              )}
            >
              {isSurplus ? "+" : "−"}{formatCurrency(Math.abs(net))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(incomeMonthly)} in &minus; {formatCurrency(recurringMonthly)} out
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
