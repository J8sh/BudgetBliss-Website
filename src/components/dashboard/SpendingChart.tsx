"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { formatCurrency, formatWholeDollars } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { STAT_RANGES } from "@/lib/finance/stats";
import type { SpendPoint, SpendSeries, StatRange } from "@/types/stats";

const BUCKET_WORD = { day: "day", week: "week", month: "month" } as const;

interface SpendingChartProps {
  series: SpendSeries | undefined;
  range: StatRange;
  onRangeChange: (range: StatRange) => void;
  isLoading?: boolean;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SpendPoint }> }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">
        {p.fullLabel}
        {p.partial && <span className="font-normal text-muted-foreground"> (so far)</span>}
      </p>
      <p className="tabular-nums text-foreground">{formatCurrency(p.total)}</p>
      <p className="text-xs text-muted-foreground">
        {p.count} {p.count === 1 ? "purchase" : "purchases"}
      </p>
    </div>
  );
}

/**
 * Day-to-day spending over a chosen range, as columns (one per day, week or month depending on
 * the range) with the average as a dashed line. Fills whatever height its grid row gives it.
 */
export function SpendingChart({ series, range, onRangeChange, isLoading }: SpendingChartProps) {
  const word = series ? BUCKET_WORD[series.bucket] : "day";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Spending, last {STAT_RANGES[range].label}
            <InfoTip label="this chart">
              Day-to-day spending from your receipts and bank imports, grouped by {word}. Recurring bills (rent,
              subscriptions on your list) and transfers like card payments aren&apos;t included, so spikes are real
              purchases. The dashed line is your average per {word}
              {series && series.bucket !== "day" ? "; the current, unfinished " + word + " is lighter and not in the average" : ""}.
            </InfoTip>
          </CardTitle>
          {series && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{formatWholeDollars(series.total)}</span> total
              {series.average !== null && (
                <>
                  {" · "}
                  <span className="tabular-nums">{formatWholeDollars(series.average)}</span> avg per {word}
                </>
              )}
            </p>
          )}
        </div>
        <div role="group" aria-label="Chart range" className="flex shrink-0 rounded-lg border border-border p-0.5">
          {(Object.keys(STAT_RANGES) as StatRange[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              title={`Last ${STAT_RANGES[r].label}`}
              onClick={() => onRangeChange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "30d" ? "30D" : r === "60d" ? "2M" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className={cn("min-h-[260px] flex-1 pb-4", isLoading && series && "opacity-60 transition-opacity")}>
        {!series ? (
          <div className="h-full min-h-[240px] animate-pulse rounded-md bg-muted" />
        ) : (
          <div className="h-full min-h-[240px]" role="img" aria-label={`Spending by ${word} for the last ${STAT_RANGES[range].label}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="15%" accessibilityLayer={false}>
                <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.6} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  width={52}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatWholeDollars(v)}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<PointTooltip />} cursor={{ className: "fill-muted", opacity: 0.5 }} />
                {series.average !== null && series.average > 0 && (
                  <ReferenceLine y={series.average} strokeDasharray="4 4" className="stroke-muted-foreground" />
                )}
                <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {series.points.map((p) => (
                    <Cell key={p.start} fill="var(--viz-1)" fillOpacity={p.partial ? 0.45 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
