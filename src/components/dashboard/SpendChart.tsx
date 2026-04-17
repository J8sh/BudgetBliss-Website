"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, fromCents } from "@/lib/utils/currency";
import type { DailySpend } from "@/types/stats";

interface SpendChartProps {
  data: DailySpend[];
  isLoading?: boolean;
}

interface TooltipEntry { value?: number }
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-primary tabular-nums">{value != null ? formatCurrency(value) : "—"}</p>
    </div>
  );
}

export function SpendChart({ data, isLoading }: SpendChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: fromCents(d.total),
    rawDate: d.date,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="drag-handle pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Daily Spend — Last 30 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-40 rounded-md bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={6}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                className="stroke-primary"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
