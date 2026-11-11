import type { ClassifiedReceipt } from "@/lib/finance/spending";
import type { DailySpend, SpendBucket, SpendPoint, StatRange, StatsResponse, TopStore } from "@/types/stats";

/**
 * Dashboard numbers: today / week / month / year totals, a spending chart for a chosen range,
 * and the top stores in that range. Only day-to-day spending counts (see spending.ts), so these
 * agree with the Insights page. All dates are UTC calendar dates, like receipt dates.
 */

export const STAT_RANGES: Record<StatRange, { label: string; bucket: SpendBucket; count: number }> = {
  "30d": { label: "30 days", bucket: "day", count: 30 },
  "60d": { label: "2 months", bucket: "day", count: 60 },
  "3m": { label: "3 months", bucket: "week", count: 13 },
  "6m": { label: "6 months", bucket: "week", count: 26 },
  "1y": { label: "1 year", bucket: "month", count: 12 },
};

export const DEFAULT_RANGE: StatRange = "30d";
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Weeks start on Sunday, matching "This Week" */
function weekStart(date: Date): Date {
  const d = utcDay(date);
  return new Date(d.getTime() - d.getUTCDay() * DAY_MS);
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addBuckets(start: Date, bucket: SpendBucket, n: number): Date {
  if (bucket === "day") return new Date(start.getTime() + n * DAY_MS);
  if (bucket === "week") return new Date(start.getTime() + n * 7 * DAY_MS);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1));
}

function bucketStart(date: Date, bucket: SpendBucket): Date {
  return bucket === "day" ? utcDay(date) : bucket === "week" ? weekStart(date) : monthStart(date);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

function labels(start: Date, bucket: SpendBucket): { label: string; fullLabel: string } {
  if (bucket === "day") return { label: fmt(start, { month: "short", day: "numeric" }), fullLabel: fmt(start, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) };
  if (bucket === "week") return { label: fmt(start, { month: "short", day: "numeric" }), fullLabel: `Week of ${fmt(start, { month: "short", day: "numeric", year: "numeric" })}` };
  return { label: fmt(start, { month: "short" }), fullLabel: fmt(start, { month: "long", year: "numeric" }) };
}

/** The first moment the stats need receipts from, for a query */
export function statsWindowStart(now: Date, range: StatRange): Date {
  const { bucket, count } = STAT_RANGES[range];
  const rangeStart = addBuckets(bucketStart(now, bucket), bucket, -(count - 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const thirtyDays = new Date(utcDay(now).getTime() - 29 * DAY_MS);
  return new Date(Math.min(rangeStart.getTime(), yearStart.getTime(), thirtyDays.getTime()));
}

export function buildStats(classified: ClassifiedReceipt[], now: Date, range: StatRange): StatsResponse {
  const spending = classified.filter((c) => c.kind === "spending");
  const today = utcDay(now);
  const sumSince = (from: Date) =>
    spending.filter((c) => c.receipt.receiptDate >= from && c.receipt.receiptDate < new Date(today.getTime() + DAY_MS)).reduce((s, c) => s + c.receipt.grandTotal, 0);

  // Chart series
  const { bucket, count } = STAT_RANGES[range];
  const first = addBuckets(bucketStart(now, bucket), bucket, -(count - 1));
  const points: SpendPoint[] = Array.from({ length: count }, (_, i) => {
    const start = addBuckets(first, bucket, i);
    return { start: iso(start), ...labels(start, bucket), total: 0, count: 0, partial: i === count - 1 && bucket !== "day" };
  });
  const index = new Map(points.map((p, i) => [p.start, i]));
  const end = new Date(today.getTime() + DAY_MS);
  const inRange = spending.filter((c) => c.receipt.receiptDate >= first && c.receipt.receiptDate < end);
  for (const c of inRange) {
    const i = index.get(iso(bucketStart(c.receipt.receiptDate, bucket)));
    if (i === undefined) continue;
    points[i]!.total += c.receipt.grandTotal;
    points[i]!.count += 1;
  }
  // The in-progress week or month would drag the average down, so it's left out
  const complete = points.filter((p) => !p.partial);
  const average = complete.length ? Math.round(complete.reduce((s, p) => s + p.total, 0) / complete.length) : null;

  // Top stores in the range, grouped the same way Insights groups them
  const stores = new Map<string, TopStore & { key: string }>();
  for (const c of inRange) {
    const { key, name } = c.allocation.merchant;
    const s = stores.get(key) ?? { key, storeName: name, total: 0, count: 0 };
    s.total += c.receipt.grandTotal;
    s.count += 1;
    stores.set(key, s);
  }

  // Last 30 days, day by day (older dashboard layout)
  const dailyFrom = new Date(today.getTime() - 29 * DAY_MS);
  const daily = new Map<string, DailySpend>();
  for (let i = 0; i < 30; i++) {
    const d = iso(new Date(dailyFrom.getTime() + i * DAY_MS));
    daily.set(d, { date: d, total: 0, count: 0 });
  }
  for (const c of spending) {
    const d = daily.get(iso(c.receipt.receiptDate));
    if (d) {
      d.total += c.receipt.grandTotal;
      d.count += 1;
    }
  }

  return {
    summary: {
      today: sumSince(today),
      week: sumSince(weekStart(now)),
      month: sumSince(monthStart(now)),
      year: sumSince(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))),
    },
    range,
    series: {
      bucket,
      points,
      average,
      total: points.reduce((s, p) => s + p.total, 0),
    },
    dailySpend: [...daily.values()],
    categoryBreakdown: [],
    topStores: [...stores.values()].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}
