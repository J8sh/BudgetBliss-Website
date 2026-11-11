"use client";

import { ChevronRight, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { formatWholeDollars } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { MoneyFlow } from "@/types/insights";

interface LeftOverBlockProps {
  money: MoneyFlow | undefined;
  isLoading?: boolean;
  onClick: () => void;
}

/**
 * What's left of this month's income after recurring bills AND day-to-day spending so far.
 * (The old "Net Monthly" only subtracted bills, which made the month look better than it was.)
 */
export function LeftOverBlock({ money, isLoading, onClick }: LeftOverBlockProps) {
  const hasIncome = (money?.income ?? 0) > 0;
  const negative = (money?.leftOver ?? 0) < 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="h-full cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <PiggyBank className="h-3.5 w-3.5" aria-hidden />
            Left this month
            <InfoTip label="left this month">
              Your monthly income minus recurring bills minus what you&apos;ve spent so far this month. It shrinks as the
              month goes on; what&apos;s left at the end is what you saved. Click the card for the math.
            </InfoTip>
          </span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !money ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        ) : !hasIncome ? (
          <p className="text-sm text-muted-foreground">Add your income below to see what&apos;s left after spending.</p>
        ) : (
          <>
            <p className={cn("text-2xl font-bold tabular-nums leading-tight", negative && "text-destructive")}>
              {negative ? "−" : ""}
              {formatWholeDollars(Math.abs(money.leftOver))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatWholeDollars(money.income)} in − {formatWholeDollars(money.fixed)} bills − {formatWholeDollars(money.flexible)} spent
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
