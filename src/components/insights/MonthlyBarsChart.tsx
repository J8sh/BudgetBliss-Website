"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatWholeDollars } from "@/lib/utils/currency";

export interface MonthBar {
  month: string;
  label: string;
  /** Cents */
  value: number;
}

interface MonthlyBarsChartProps {
  data: MonthBar[];
  /** Month drawn in the accent color; the rest are de-emphasized */
  highlight?: string;
  /** Cents; drawn as a dashed reference line */
  average?: number | null;
  height?: number;
  onSelect?: (month: string) => void;
  /** Read out by screen readers, since the bars themselves aren't */
  ariaLabel: string;
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthBar }> }) {
  const bar = payload?.[0]?.payload;
  if (!active || !bar) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{bar.label}</p>
      <p className="tabular-nums text-muted-foreground">{formatCurrency(bar.value)}</p>
    </div>
  );
}

/** Monthly totals as columns: one month emphasized, an optional average line, hover for values */
export function MonthlyBarsChart({ data, highlight, average, height = 200, onSelect, ariaLabel }: MonthlyBarsChartProps) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        {/* Recharts' own keyboard layer would grab focus when a dialog opens; the role="img" label
            and the figures listed next to each chart carry the same information */}
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} strokeDasharray="0" className="stroke-border" strokeOpacity={0.6} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatWholeDollars(v)}
            className="fill-muted-foreground"
          />
          <Tooltip content={<BarTooltip />} cursor={{ className: "fill-muted", opacity: 0.5 }} />
          {average != null && average > 0 && (
            <ReferenceLine
              y={average}
              strokeDasharray="4 4"
              className="stroke-muted-foreground"
              label={{ value: "avg", position: "insideTopRight", fontSize: 11, className: "fill-muted-foreground" }}
            />
          )}
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            onClick={onSelect ? (bar: { payload?: MonthBar }) => bar.payload && onSelect(bar.payload.month) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === highlight ? "var(--viz-1)" : "var(--viz-muted)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
