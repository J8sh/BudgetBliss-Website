import { Receipt } from "@/lib/models/Receipt";
import { Income } from "@/lib/models/Income";
import { RecurringCost } from "@/lib/models/RecurringCost";
import { MerchantRule } from "@/lib/models/MerchantRule";
import { allocateReceipt, type SpendReceipt } from "@/lib/finance/allocate";
import { guessMerchant, isCategoryId, type CategoryId } from "@/lib/finance/categories";
import { addMonths, buildInsightsReport, monthOf, TREND_MONTHS } from "@/lib/finance/insights";
import type { InsightsReport, MerchantSummary } from "@/types/insights";

/** Database reads for the insights; the math lives in insights.ts */

export async function loadRules(): Promise<Map<string, CategoryId>> {
  const rules = await MerchantRule.find({}).select("key category").lean();
  return new Map(rules.filter((r) => isCategoryId(r.category)).map((r) => [r.key, r.category]));
}

function toSpendReceipt(r: {
  _id: { toString(): string };
  storeName: string;
  receiptDate: Date;
  grandTotal: number;
  tags?: string[];
  lineItems?: Array<{ name: string; totalPrice: number; category?: string }>;
}): SpendReceipt {
  return {
    id: r._id.toString(),
    storeName: r.storeName,
    receiptDate: r.receiptDate,
    grandTotal: r.grandTotal,
    tags: r.tags ?? [],
    lineItems: (r.lineItems ?? []).map((i) => ({ name: i.name, totalPrice: i.totalPrice, category: i.category })),
  };
}

const RECEIPT_FIELDS = "_id storeName receiptDate grandTotal tags lineItems.name lineItems.totalPrice lineItems.category";

async function availableMonths(): Promise<string[]> {
  const rows = (await Receipt.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$receiptDate" } } } },
    { $sort: { _id: -1 } },
  ])) as Array<{ _id: string }>;
  return rows.map((r) => r._id);
}

export async function loadInsightsReport(month: string, now: Date = new Date()): Promise<InsightsReport> {
  const from = new Date(`${addMonths(month, -(TREND_MONTHS - 1))}-01T00:00:00Z`);
  const to = new Date(`${addMonths(month, 1)}-01T00:00:00Z`);
  const monthStart = new Date(`${month}-01T00:00:00Z`);

  const [receipts, rules, recurring, income, needsReview, months] = await Promise.all([
    Receipt.find({ receiptDate: { $gte: from, $lt: to } }).select(RECEIPT_FIELDS).lean(),
    loadRules(),
    RecurringCost.find({ isActive: true }).select("name amount frequency category").lean(),
    Income.find({ isActive: true }).select("amount frequency").lean(),
    Receipt.countDocuments({ receiptDate: { $gte: monthStart, $lt: to }, extractionMethod: "failed" }),
    availableMonths(),
  ]);

  return buildInsightsReport({
    month,
    now,
    receipts: receipts.map(toSpendReceipt),
    rules,
    recurring: recurring.map((r) => ({ name: r.name, amount: r.amount, frequency: r.frequency, category: r.category })),
    income: income.map((i) => ({ amount: i.amount, frequency: i.frequency })),
    needsReview,
    availableMonths: months,
  });
}

/** Every store you've bought from, with how its receipts are categorized, biggest spend first */
export async function loadMerchants(): Promise<MerchantSummary[]> {
  const [receipts, rules] = await Promise.all([Receipt.find({}).select(RECEIPT_FIELDS).lean(), loadRules()]);

  const byKey = new Map<string, MerchantSummary & { nameCounts: Map<string, number> }>();
  for (const raw of receipts) {
    const r = toSpendReceipt(raw);
    const allocation = allocateReceipt(r, rules);
    const { merchant } = allocation;
    const entry =
      byKey.get(merchant.key) ??
      {
        key: merchant.key,
        name: merchant.name,
        category: allocation.parts[0]?.category ?? merchant.category ?? "uncategorized",
        source: allocation.source,
        suggested: guessMerchant(r.storeName).category,
        mixed: merchant.mixed,
        visits: 0,
        total: 0,
        lastVisit: "",
        nameCounts: new Map<string, number>(),
      };
    entry.visits += 1;
    entry.total += r.grandTotal;
    const date = r.receiptDate.toISOString().slice(0, 10);
    if (date > entry.lastVisit) entry.lastVisit = date;
    // A store split by items shows as "items"; otherwise keep the strongest source seen
    if (allocation.source === "items") entry.source = "items";
    entry.nameCounts.set(r.storeName, (entry.nameCounts.get(r.storeName) ?? 0) + 1);
    byKey.set(merchant.key, entry);
  }

  return [...byKey.values()]
    .map(({ nameCounts, ...m }) => ({
      ...m,
      // Unrecognized stores show the spelling that appears most on receipts
      name: m.suggested || m.source === "yours" ? m.name : [...nameCounts].sort((a, b) => b[1] - a[1])[0]![0],
      category: rules.get(m.key) ?? m.category,
      source: rules.has(m.key) ? ("yours" as const) : m.source,
    }))
    .sort((a, b) => b.total - a.total);
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(now);
}
