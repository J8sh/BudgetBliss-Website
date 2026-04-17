"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { Receipt } from "@/types/receipt";

export function RecentReceiptsBlock() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch5() {
      try {
        const res = await fetch("/api/receipts?limit=5&sortBy=createdAt&sortOrder=desc");
        if (res.ok) {
          const data = (await res.json()) as { receipts: Receipt[] };
          setReceipts(data.receipts);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void fetch5();
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="drag-handle pb-2 shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent Receipts</CardTitle>
        <Link href="/receipts" className="text-xs text-primary flex items-center gap-1 hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No receipts yet.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => (
              <Link
                key={r._id}
                href={`/receipts/${r._id}`}
                className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-1 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.storeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.receiptDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {r.isDuplicate && (
                    <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">!</Badge>
                  )}
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(r.grandTotal)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
