"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { TopStore } from "@/types/stats";

interface TopStoresListBlockProps {
  stores: TopStore[];
  isLoading?: boolean;
}

export function TopStoresListBlock({ stores, isLoading }: TopStoresListBlockProps) {
  const maxTotal = stores[0]?.total ?? 1;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="drag-handle pb-2 shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Top Stores — This Month</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {stores.slice(0, 5).map((store) => (
              <div key={store.storeName} className="space-y-0.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{store.storeName}</span>
                  <span className="tabular-nums shrink-0 ml-2 text-muted-foreground">
                    {formatCurrency(store.total)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(store.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
