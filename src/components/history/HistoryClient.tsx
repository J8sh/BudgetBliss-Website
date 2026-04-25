"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, toISODateString } from "@/lib/utils/dates";
import type { Receipt } from "@/types/receipt";

interface PaginatedResponse {
  receipts: Receipt[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const QUICK_FILTERS = [
  { label: "This Month", fn: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", fn: () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return { from: startOfMonth(d), to: endOfMonth(d) };
  }},
  { label: "This Year", fn: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  { label: "Last 7 Days", fn: () => {
    const to = new Date();
    const from = new Date(to); from.setDate(from.getDate() - 6);
    return { from, to };
  }},
  { label: "Last 30 Days", fn: () => {
    const to = new Date();
    const from = new Date(to); from.setDate(from.getDate() - 29);
    return { from, to };
  }},
];

export function HistoryClient() {
  const today = toISODateString(new Date());
  const monthStart = toISODateString(startOfMonth(new Date()));

  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchHistory(from: string, to: string) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        limit: "100",
        sortBy: "receiptDate",
        sortOrder: "desc",
      });
      const res = await fetch(`/api/receipts?${params}`);
      if (res.ok) setData(await res.json() as PaginatedResponse);
    } finally {
      setIsLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchHistory(dateFrom, dateTo); }, []); // mount-only: subsequent fetches triggered by "Apply" button

  function applyQuickFilter(from: Date, to: Date) {
    const f = toISODateString(from);
    const t = toISODateString(to);
    setDateFrom(f);
    setDateTo(t);
    void fetchHistory(f, t);
  }

  const totalSpend = data?.receipts.reduce((sum, r) => sum + r.grandTotal, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => fetchHistory(dateFrom, dateTo)} disabled={isLoading}>
              {isLoading ? "Loading…" : "Apply"}
            </Button>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_FILTERS.map(({ label, fn }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => { const { from, to } = fn(); applyQuickFilter(from, to); }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalSpend)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{data.receipts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">Avg per Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {data.receipts.length > 0 ? formatCurrency(Math.round(totalSpend / data.receipts.length)) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">Duplicates Flagged</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {data.receipts.filter((r) => r.isDuplicate).length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt list */}
      {data && data.receipts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">
            {data.receipts.length} receipt{data.receipts.length !== 1 ? "s" : ""}
          </h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {data.receipts.map((r) => (
              <Link
                key={r._id}
                href={`/receipts/${r._id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.storeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.receiptDate).toLocaleDateString("en-US", {
                      weekday: "short", year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {r.isDuplicate && (
                    <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                      Duplicate?
                    </Badge>
                  )}
                  <span className="font-semibold tabular-nums">{formatCurrency(r.grandTotal)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && data.receipts.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground py-12">
          No receipts found for the selected date range.
        </p>
      )}
    </div>
  );
}
