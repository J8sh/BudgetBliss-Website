"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { formatCurrency } from "@/lib/utils/currency";
import type { TopStore } from "@/types/stats";

interface TopStoresListBlockProps {
  stores: TopStore[];
  isLoading?: boolean;
  title?: string;
  /** How many stores to show */
  limit?: number;
}

/** Where the most money went, as ranked bars on one baseline (easier to compare than a donut) */
export function TopStoresListBlock({ stores, isLoading, title = "Top Stores — This Month", limit = 5 }: TopStoresListBlockProps) {
  const maxTotal = stores[0]?.total ?? 1;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="drag-handle pb-2 shrink-0">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {title}
          <InfoTip label="top stores">
            The stores where you spent the most in this period, biggest first, with how many purchases. Different
            spellings of the same store (like &quot;WM SUPERCENTER&quot; and &quot;Walmart&quot;) are combined, and bills
            and transfers are left out.
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading && stores.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No spending in this period.</p>
        ) : (
          <ul className="space-y-2.5">
            {stores.slice(0, limit).map((store) => (
              <li key={store.storeName} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{store.storeName}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-xs text-muted-foreground">{store.count}× </span>
                    {formatCurrency(store.total)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-viz-1" style={{ width: `${(store.total / maxTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
