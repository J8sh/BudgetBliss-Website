"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatWholeDollars } from "@/lib/utils/currency";
import type { Habits } from "@/types/insights";

/** Patterns behind the totals: where you go most, how small purchases add up, the biggest ones */
export function HabitsCard({ habits }: { habits: Habits }) {
  const { topMerchants, smallPurchases, biggest } = habits;
  if (topMerchants.length === 0 && biggest.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Habits</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <section>
          <h3 className="mb-2 text-sm font-medium">Where you go most</h3>
          {topMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No store visited twice this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topMerchants.map((m) => (
                <li key={m.key} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{m.name}</span>
                  <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                    {m.visits}× · avg {formatWholeDollars(m.average)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Small purchases</h3>
          <p className="text-2xl font-semibold tabular-nums">{formatWholeDollars(smallPurchases.total)}</p>
          <p className="text-sm text-muted-foreground">
            {smallPurchases.count} {smallPurchases.count === 1 ? "purchase" : "purchases"} under{" "}
            {formatWholeDollars(smallPurchases.threshold)}. They&apos;re easy to miss one at a time.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Biggest purchases</h3>
          <ul className="space-y-2 text-sm">
            {biggest.map((p) => (
              <li key={p.receiptId}>
                <Link href={`/receipts/${p.receiptId}`} className="flex items-baseline justify-between gap-2 hover:underline">
                  <span className="min-w-0 truncate">{p.storeName}</span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
