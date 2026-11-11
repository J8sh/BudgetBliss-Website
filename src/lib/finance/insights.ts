import { allocateReceipt, type SpendReceipt } from "@/lib/finance/allocate";
import { classifyReceipts } from "@/lib/finance/spending";
import {
  CATEGORIES,
  categoryFromText,
  categoryLabel,
  type CategoryId,
  type CategoryKey,
  type StoreChoice,
} from "@/lib/finance/categories";
import type {
  CategoryTotal,
  ChangeDriver,
  Insight,
  InsightsReport,
  MerchantTotal,
  PurchaseRef,
  TrendPoint,
} from "@/types/insights";

/*
 * Turns receipts, recurring costs and income into a month's spending review. Pure: no
 * database access, so every number here is unit-tested.
 *
 * Terms used throughout (and in the UI):
 * - fixed:    recurring costs (rent, subscriptions), converted to a monthly amount
 * - flexible: receipts, i.e. day-to-day spending
 * - left over: income − fixed − flexible
 *
 * Income and recurring costs have no history, so every month uses the current list.
 */

export interface RecurringInput {
  name: string;
  amount: number;
  frequency: string;
  category?: string;
}

export interface IncomeInput {
  amount: number;
  frequency: string;
}

export interface InsightsInput {
  /** "YYYY-MM" */
  month: string;
  now: Date;
  /** Receipts from at least the 12 months ending with `month` */
  receipts: SpendReceipt[];
  /** Your store → category choices, keyed by merchant key */
  rules: ReadonlyMap<string, StoreChoice>;
  recurring: RecurringInput[];
  income: IncomeInput[];
  /** Receipts in `month` whose photo couldn't be read */
  needsReview: number;
  availableMonths: string[];
}

export const TREND_MONTHS = 12;
export const AVERAGE_MONTHS = 6;
export const SMALL_PURCHASE_CENTS = 1500;
/** Below this, a change between months isn't worth calling out */
const NOTABLE_CHANGE_CENTS = 2000;

const MONTHLY_FACTORS: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export function toMonthly(amount: number, frequency: string): number {
  return Math.round(amount * (MONTHLY_FACTORS[frequency] ?? 1));
}

// ─── Month helpers (receipt dates are stored as UTC midnight) ────────────────

export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthOf(d);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Math.round(cents / 100),
  );
const percent = (share: number) => `${Math.round(share * 100)}%`;

// ─── Report ──────────────────────────────────────────────────────────────────

interface MonthBucket {
  receipts: SpendReceipt[];
  /** Receipts that count as day-to-day spending (not transfers, not already-counted bills) */
  spending: SpendReceipt[];
  /** Card payments, savings and other money moved rather than spent */
  transfers: { count: number; total: number };
  flexibleByCategory: Map<CategoryKey, number>;
  merchantByCategory: Map<CategoryKey, Map<string, MerchantTotal>>;
  purchases: PurchaseRef[];
  flexible: number;
  matchedToFixed: number;
}

export function buildInsightsReport(input: InsightsInput): InsightsReport {
  const { month, now, rules } = input;
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => addMonths(month, i - (TREND_MONTHS - 1)));

  // Fixed costs, monthly, by category
  const fixedByCategory = new Map<CategoryKey, number>();
  const fixedItems = input.recurring.map((r) => ({
    name: r.name,
    monthly: toMonthly(r.amount, r.frequency),
    category: categoryFromText(r.category) ?? categoryFromText(r.name) ?? ("housing" as CategoryId),
  }));
  for (const f of fixedItems) fixedByCategory.set(f.category, (fixedByCategory.get(f.category) ?? 0) + f.monthly);
  const fixedTotal = fixedItems.reduce((s, f) => s + f.monthly, 0);
  const incomeTotal = input.income.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);

  // Bucket receipts by month and allocate them to categories
  const buckets = new Map<string, MonthBucket>();
  for (const m of trendMonths) {
    buckets.set(m, {
      receipts: [],
      spending: [],
      transfers: { count: 0, total: 0 },
      flexibleByCategory: new Map(),
      merchantByCategory: new Map(),
      purchases: [],
      flexible: 0,
      matchedToFixed: 0,
    });
  }
  const classified = classifyReceipts(input.receipts, rules, fixedItems.map((f) => f.monthly));

  for (const { receipt: r, allocation, kind } of classified) {
    const bucket = buckets.get(monthOf(r.receiptDate));
    if (!bucket) continue;
    bucket.receipts.push(r);
    if (kind === "transfer") {
      bucket.transfers.count++;
      bucket.transfers.total += r.grandTotal;
      continue;
    }
    if (kind === "bill") {
      bucket.matchedToFixed++;
      continue;
    }

    bucket.spending.push(r);
    for (const part of allocation.parts) {
      bucket.flexibleByCategory.set(part.category, (bucket.flexibleByCategory.get(part.category) ?? 0) + part.amount);
      const merchants = bucket.merchantByCategory.get(part.category) ?? new Map<string, MerchantTotal>();
      const m = merchants.get(allocation.merchant.key) ?? { key: allocation.merchant.key, name: allocation.merchant.name, total: 0, visits: 0 };
      m.total += part.amount;
      m.visits += 1;
      merchants.set(allocation.merchant.key, m);
      bucket.merchantByCategory.set(part.category, merchants);
      bucket.purchases.push({
        receiptId: r.id,
        storeName: r.storeName,
        date: r.receiptDate.toISOString().slice(0, 10),
        amount: part.amount,
        category: part.category,
      });
    }
    bucket.flexible += r.grandTotal;
  }

  const current = buckets.get(month)!;
  const previousMonth = addMonths(month, -1);
  const previous = buckets.get(previousMonth)!;
  const averageMonths = trendMonths
    .slice(TREND_MONTHS - 1 - AVERAGE_MONTHS, TREND_MONTHS - 1)
    .filter((m) => buckets.get(m)!.spending.length > 0);

  const categoryTotalIn = (m: string, key: CategoryKey) =>
    (buckets.get(m)!.flexibleByCategory.get(key) ?? 0) + (fixedByCategory.get(key) ?? 0);

  // ─── Categories ────────────────────────────────────────────────────────────
  const monthSpending = current.flexible + fixedTotal;
  const keys = new Set<CategoryKey>([...current.flexibleByCategory.keys(), ...fixedByCategory.keys()]);
  for (const m of averageMonths) for (const k of buckets.get(m)!.flexibleByCategory.keys()) keys.add(k);

  const categories: CategoryTotal[] = [...keys]
    .map((key): CategoryTotal => {
      const flexible = current.flexibleByCategory.get(key) ?? 0;
      const fixed = fixedByCategory.get(key) ?? 0;
      const total = flexible + fixed;
      const average = averageMonths.length
        ? Math.round(averageMonths.reduce((s, m) => s + categoryTotalIn(m, key), 0) / averageMonths.length)
        : null;
      return {
        key,
        label: categoryLabel(key),
        kind: key === "uncategorized" ? null : CATEGORIES[key].kind,
        total,
        fixed,
        flexible,
        share: monthSpending > 0 ? total / monthSpending : 0,
        previous: categoryTotalIn(previousMonth, key),
        average,
        topMerchants: [...(current.merchantByCategory.get(key)?.values() ?? [])].sort((a, b) => b.total - a.total).slice(0, 5),
        largest: current.purchases.filter((p) => p.category === key).sort((a, b) => b.amount - a.amount).slice(0, 3),
        history: trendMonths.map((m) => categoryTotalIn(m, key)),
      };
    })
    .filter((c) => c.total > 0 || c.previous > 0 || (c.average ?? 0) > 0)
    .sort((a, b) => b.total - a.total);

  // ─── Money in / out and the needs / wants / savings split ─────────────────
  const leftOver = incomeTotal - fixedTotal - current.flexible;
  const money = {
    income: incomeTotal,
    fixed: fixedTotal,
    flexible: current.flexible,
    leftOver,
    savingsRate: incomeTotal > 0 ? leftOver / incomeTotal : null,
    fixedShare: incomeTotal > 0 ? fixedTotal / incomeTotal : null,
  };

  const sumKind = (kind: "need" | "want") => categories.filter((c) => c.kind === kind).reduce((s, c) => s + c.total, 0);
  const needs = sumKind("need");
  const wants = sumKind("want");
  const unsorted = categories.filter((c) => c.kind === null).reduce((s, c) => s + c.total, 0);
  const shareOfIncome = (v: number) => (incomeTotal > 0 ? v / incomeTotal : null);
  const split = {
    income: incomeTotal,
    needs,
    wants,
    unsorted,
    savings: leftOver,
    needsShare: shareOfIncome(needs),
    wantsShare: shareOfIncome(wants),
    savingsShare: shareOfIncome(leftOver),
    unsortedShare: shareOfIncome(unsorted),
  };

  // ─── What changed vs last month ────────────────────────────────────────────
  // "Not sorted yet" shrinking just means stores got categorized; it isn't a spending change
  const drivers: ChangeDriver[] = categories
    .filter((c) => c.key !== "uncategorized")
    .map((c): ChangeDriver => {
      const delta = c.flexible - (previous.flexibleByCategory.get(c.key) ?? 0);
      const before = previous.merchantByCategory.get(c.key) ?? new Map<string, MerchantTotal>();
      const after = current.merchantByCategory.get(c.key) ?? new Map<string, MerchantTotal>();
      let merchant: ChangeDriver["merchant"];
      for (const key of new Set([...before.keys(), ...after.keys()])) {
        const d = (after.get(key)?.total ?? 0) - (before.get(key)?.total ?? 0);
        if (Math.sign(d) === Math.sign(delta) && (!merchant || Math.abs(d) > Math.abs(merchant.delta))) {
          merchant = { name: after.get(key)?.name ?? before.get(key)!.name, delta: d };
        }
      }
      return { key: c.key, label: c.label, delta, merchant };
    })
    .filter((d) => Math.abs(d.delta) >= NOTABLE_CHANGE_CENTS)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const averageFlexible = averageMonths.length
    ? Math.round(averageMonths.reduce((s, m) => s + buckets.get(m)!.flexible, 0) / averageMonths.length)
    : null;
  const change = {
    previousLabel: monthLabel(previousMonth),
    previousFlexible: previous.flexible,
    flexibleDelta: current.flexible - previous.flexible,
    average: averageFlexible,
    drivers,
  };

  // ─── Pace (current month only) ─────────────────────────────────────────────
  const isCurrentMonth = monthOf(now) === month;
  const dim = daysInMonth(month);
  const daysElapsed = isCurrentMonth ? now.getUTCDate() : dim;
  const pace = isCurrentMonth
    ? {
        spentSoFar: current.flexible,
        sameDayLastMonth: previous.spending
          .filter((r) => r.receiptDate.getUTCDate() <= Math.min(daysElapsed, daysInMonth(previousMonth)))
          .reduce((s, r) => s + r.grandTotal, 0),
        lastMonthTotal: previous.flexible,
        projected: daysElapsed >= 7 ? Math.round((current.flexible / daysElapsed) * dim) : null,
      }
    : null;

  // ─── Habits ────────────────────────────────────────────────────────────────
  const visitsByMerchant = new Map<string, MerchantTotal>();
  for (const r of current.spending) {
    const allocation = allocateReceipt(r, rules);
    const m = visitsByMerchant.get(allocation.merchant.key) ?? { key: allocation.merchant.key, name: allocation.merchant.name, total: 0, visits: 0 };
    m.total += r.grandTotal;
    m.visits += 1;
    visitsByMerchant.set(m.key, m);
  }
  const small = current.spending.filter((r) => r.grandTotal > 0 && r.grandTotal < SMALL_PURCHASE_CENTS);
  const habits = {
    topMerchants: [...visitsByMerchant.values()]
      .filter((m) => m.visits >= 2)
      .sort((a, b) => b.visits - a.visits || b.total - a.total)
      .slice(0, 5)
      .map((m) => ({ ...m, average: Math.round(m.total / m.visits) })),
    smallPurchases: { threshold: SMALL_PURCHASE_CENTS, count: small.length, total: small.reduce((s, r) => s + r.grandTotal, 0) },
    biggest: [...current.spending]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 3)
      .map((r) => ({
        receiptId: r.id,
        storeName: r.storeName,
        date: r.receiptDate.toISOString().slice(0, 10),
        amount: r.grandTotal,
        category: allocateReceipt(r, rules).parts[0]?.category ?? "uncategorized",
      })),
  };

  // ─── Trend ─────────────────────────────────────────────────────────────────
  const trend: TrendPoint[] = trendMonths.map((m) => ({
    month: m,
    label: monthLabel(m, "short"),
    flexible: buckets.get(m)!.flexible,
    fixed: fixedTotal,
    total: buckets.get(m)!.flexible + fixedTotal,
  }));

  const uncategorized = categories.find((c) => c.key === "uncategorized");
  const coverage = {
    uncategorizedTotal: uncategorized?.flexible ?? 0,
    uncategorizedMerchants: uncategorized?.topMerchants.length ?? 0,
    needsReview: input.needsReview,
    matchedToFixed: current.matchedToFixed,
    transfers: current.transfers,
  };

  const report: Omit<InsightsReport, "insights"> = {
    month,
    label: monthLabel(month),
    isCurrentMonth,
    daysElapsed,
    daysInMonth: dim,
    receiptCount: current.spending.length,
    money,
    categories,
    split,
    change,
    pace,
    habits,
    trend,
    coverage,
    availableMonths: input.availableMonths,
  };
  return { ...report, insights: writeInsights(report) };
}

// ─── Plain-language takeaways ────────────────────────────────────────────────

/**
 * The few sentences worth reading first, most important first. Written to inform, not to
 * judge: benchmarks are described as common rules of thumb.
 */
export function writeInsights(r: Omit<InsightsReport, "insights">): Insight[] {
  const out: Insight[] = [];
  const when = r.isCurrentMonth ? `so far in ${r.label.split(" ")[0]}` : `in ${r.label}`;

  if (r.receiptCount === 0 && r.money.fixed === 0) {
    return [{ id: "empty", tone: "neutral", title: `No spending recorded ${when}.`, detail: "Upload receipts or import a bank statement to see where your money goes." }];
  }

  // 1. Headline: day-to-day spending against the usual
  if (r.pace) {
    const diff = r.pace.spentSoFar - r.pace.sameDayLastMonth;
    out.push({
      id: "pace",
      tone: "neutral",
      title: `You've spent ${dollars(r.pace.spentSoFar)} on day-to-day purchases ${when}.`,
      detail:
        Math.abs(diff) < 1000
          ? `That's about where you were on day ${r.daysElapsed} of last month.`
          : `By day ${r.daysElapsed} last month you'd spent ${dollars(r.pace.sameDayLastMonth)}, so you're ${dollars(Math.abs(diff))} ${diff > 0 ? "ahead of" : "behind"} that pace.` +
            (r.pace.projected !== null ? ` At this rate the month ends near ${dollars(r.pace.projected)}.` : ""),
    });
  } else if (r.change.average !== null) {
    const diff = r.money.flexible - r.change.average;
    const close = Math.abs(diff) <= r.change.average * 0.1;
    out.push({
      id: "headline",
      tone: close ? "neutral" : diff < 0 ? "good" : "watch",
      title: `You spent ${dollars(r.money.flexible)} on day-to-day purchases ${when}.`,
      detail: close
        ? `That's close to your recent average of ${dollars(r.change.average)} a month.`
        : `That's ${dollars(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than your recent average of ${dollars(r.change.average)} a month.`,
    });
  } else {
    out.push({ id: "headline", tone: "neutral", title: `You spent ${dollars(r.money.flexible)} on day-to-day purchases ${when}.` });
  }

  // 2. Where most of it went. Mid-month, a full month of bills would dwarf a partial month of
  // purchases, so only day-to-day spending is ranked until the month is over.
  if (r.isCurrentMonth) {
    const topFlexible = [...r.categories]
      .filter((c) => c.key !== "uncategorized" && c.flexible > 0)
      .sort((a, b) => b.flexible - a.flexible)[0];
    if (topFlexible && r.money.flexible > 0) {
      out.push({
        id: "top-category",
        tone: "neutral",
        title: `${topFlexible.label} leads your day-to-day spending so far: ${dollars(topFlexible.flexible)}, ${percent(topFlexible.flexible / r.money.flexible)}.`,
        action: { type: "category", key: topFlexible.key },
      });
    }
  }
  const top = r.isCurrentMonth ? undefined : r.categories.find((c) => c.key !== "uncategorized" && c.total > 0);
  if (top) {
    out.push({
      id: "top-category",
      tone: "neutral",
      title: `${top.label} is your biggest expense: ${dollars(top.total)}, ${percent(top.share)} of everything you spent.`,
      detail: top.fixed > 0 && top.flexible > 0 ? `${dollars(top.fixed)} of that is recurring costs.` : undefined,
      action: { type: "category", key: top.key },
    });
  }

  // 3. The biggest change from last month
  const driver = r.change.drivers[0];
  if (driver && !r.isCurrentMonth) {
    out.push({
      id: "change",
      tone: driver.delta > 0 ? "watch" : "good",
      title: `${driver.label} was ${driver.delta > 0 ? "up" : "down"} ${dollars(Math.abs(driver.delta))} from ${r.change.previousLabel.split(" ")[0]}.`,
      detail: driver.merchant ? `Mostly ${driver.merchant.name} (${driver.merchant.delta > 0 ? "+" : "−"}${dollars(Math.abs(driver.merchant.delta))}).` : undefined,
      action: { type: "category", key: driver.key },
    });
  }

  // 4. Money left over
  if (r.money.savingsRate !== null && !r.isCurrentMonth) {
    const rate = r.money.savingsRate;
    out.push({
      id: "savings",
      tone: rate >= 0.2 ? "good" : rate < 0.05 ? "watch" : "neutral",
      title:
        r.money.leftOver >= 0
          ? `You kept ${dollars(r.money.leftOver)} of your ${dollars(r.money.income)} income, ${percent(rate)}.`
          : `You spent ${dollars(-r.money.leftOver)} more than your ${dollars(r.money.income)} income.`,
      detail: "A common rule of thumb is to keep at least 20% for savings and goals.",
      action: { type: "budget-rule" },
    });
  }

  // 5. How much of income is already committed
  if (r.money.fixedShare !== null && r.money.fixed > 0) {
    out.push({
      id: "fixed",
      tone: r.money.fixedShare > 0.5 ? "watch" : "neutral",
      title: `Recurring bills take ${percent(r.money.fixedShare)} of your income (${dollars(r.money.fixed)} a month).`,
      detail: r.money.fixedShare > 0.5 ? "When more than half is committed before the month starts, there's little room for surprises." : undefined,
      action: { type: "budget-rule" },
    });
  }

  // 6. Habits
  const regular = r.habits.topMerchants[0];
  if (regular && regular.visits >= 3) {
    out.push({
      id: "regular",
      tone: "neutral",
      title: `${regular.visits} trips to ${regular.name} came to ${dollars(regular.total)}, about ${dollars(regular.average)} each.`,
    });
  }
  if (r.habits.smallPurchases.count >= 5) {
    out.push({
      id: "small",
      tone: "neutral",
      title: `${r.habits.smallPurchases.count} small purchases under ${dollars(r.habits.smallPurchases.threshold)} added up to ${dollars(r.habits.smallPurchases.total)}.`,
    });
  }

  // 7. Data that would make this more accurate
  const sortedShare = r.money.flexible > 0 ? r.coverage.uncategorizedTotal / r.money.flexible : 0;
  if (sortedShare > 0.1) {
    out.push({
      id: "categorize",
      tone: "watch",
      title: `${dollars(r.coverage.uncategorizedTotal)} (${percent(sortedShare)}) of this month's spending isn't sorted into a category yet.`,
      detail: "Sorting a few stores makes every number here more accurate.",
      action: { type: "categorize" },
    });
  }
  if (r.coverage.needsReview > 0) {
    out.push({
      id: "review",
      tone: "watch",
      title: `${r.coverage.needsReview} receipt${r.coverage.needsReview === 1 ? "" : "s"} this month couldn't be read and may have the wrong amount.`,
      action: { type: "review" },
    });
  }

  return out;
}
