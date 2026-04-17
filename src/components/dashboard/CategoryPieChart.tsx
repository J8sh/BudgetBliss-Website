"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { TopStore } from "@/types/stats";

const COLORS = [
  "oklch(0.60 0.20 240)",  // blue
  "oklch(0.65 0.20 280)",  // purple
  "oklch(0.62 0.18 195)",  // teal
  "oklch(0.70 0.18 50)",   // amber
  "oklch(0.62 0.20 15)",   // rose
  "oklch(0.62 0.16 150)",  // green
  "oklch(0.75 0.17 80)",   // yellow
  "oklch(0.55 0.22 260)",  // indigo
];

interface TopStoresChartProps {
  stores: TopStore[];
  isLoading?: boolean;
}

interface TooltipEntry { name?: string; value?: number }
function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-sm">
      <p className="font-medium text-foreground">{entry?.name}</p>
      <p className="text-primary tabular-nums">
        {entry?.value != null ? formatCurrency(entry.value) : "—"}
      </p>
    </div>
  );
}

export function TopStoresChart({ stores, isLoading }: TopStoresChartProps) {
  const chartData = stores.map((s) => ({
    name: s.storeName,
    value: s.total,
  }));

  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="drag-handle pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Stores — This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-32 rounded-md bg-muted animate-pulse" />
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : stores.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            No data yet
          </div>
        ) : (
          <div className="space-y-3">
            {/* Donut chart */}
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Custom legend */}
            <div className="space-y-1.5">
              {chartData.map((item, index) => {
                const pct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="shrink-0 h-2 w-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-foreground">{item.name}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">{pct}%</span>
                    <span className="tabular-nums font-medium shrink-0">{formatCurrency(item.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
