import type { SpendReceipt } from "@/lib/finance/allocate";
import type { CategoryId, StoreChoice } from "@/lib/finance/categories";
import {
  addMonths,
  buildInsightsReport,
  daysInMonth,
  monthLabel,
  toMonthly,
  type InsightsInput,
} from "@/lib/finance/insights";

let nextId = 0;
function r(date: string, store: string, cents: number, extra: Partial<SpendReceipt> = {}): SpendReceipt {
  return { id: `r${nextId++}`, storeName: store, receiptDate: new Date(date), grandTotal: cents, tags: [], lineItems: [], ...extra };
}

function input(overrides: Partial<InsightsInput>): InsightsInput {
  return {
    month: "2026-09",
    now: new Date("2026-11-10T12:00:00Z"),
    receipts: [],
    rules: new Map<string, CategoryId>(),
    recurring: [{ name: "Rent", amount: 100000, frequency: "monthly", category: "Rent" }],
    income: [{ amount: 400000, frequency: "monthly" }],
    needsReview: 0,
    availableMonths: [],
    ...overrides,
  };
}

describe("month helpers", () => {
  it("moves across years and knows month lengths", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-09", "short")).toBe("Sep");
  });

  it("converts frequencies to monthly amounts", () => {
    expect(toMonthly(1200, "yearly")).toBe(100);
    expect(toMonthly(1000, "weekly")).toBe(4333);
    expect(toMonthly(300, "quarterly")).toBe(100);
  });
});

describe("buildInsightsReport", () => {
  const receipts = [
    // August
    r("2026-08-03", "ALDI", 20000),
    r("2026-08-10", "Chipotle", 1500),
    // September
    r("2026-09-02", "ALDI", 25000),
    r("2026-09-05", "Starbucks Coffee #1", 600),
    r("2026-09-06", "Starbucks Coffee #2", 700),
    r("2026-09-07", "Starbucks Coffee", 500),
    r("2026-09-12", "Fox & Hound", 9000),
    r("2026-09-20", "Riverside Plaza", 3000),
    r("2026-09-21", "Casey's", 4000),
    r("2026-09-22", "Casey's", 500),
  ];

  it("adds up money in and out", () => {
    const report = buildInsightsReport(input({ receipts }));
    expect(report.money).toEqual({
      income: 400000,
      fixed: 100000,
      flexible: 43300,
      leftOver: 256700,
      savingsRate: 256700 / 400000,
      fixedShare: 0.25,
    });
    expect(report.receiptCount).toBe(8);
  });

  it("breaks spending into categories, including recurring bills", () => {
    const { categories } = buildInsightsReport(input({ receipts }));
    const byKey = Object.fromEntries(categories.map((c) => [c.key, c]));
    expect(byKey["housing"]).toMatchObject({ total: 100000, fixed: 100000, flexible: 0, kind: "need" });
    expect(byKey["groceries"]).toMatchObject({ total: 25000, previous: 20000, average: 20000 });
    expect(byKey["dining"]).toMatchObject({ total: 10800, previous: 1500 });
    expect(byKey["transportation"]).toMatchObject({ total: 4500 });
    expect(byKey["uncategorized"]).toMatchObject({ total: 3000, kind: null });
    expect(categories[0]!.key).toBe("housing");
    expect(categories.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
    expect(byKey["dining"]!.topMerchants[0]).toMatchObject({ name: "Fox & Hound", visits: 1 });
    expect(byKey["dining"]!.topMerchants[1]).toMatchObject({ name: "Starbucks", visits: 3, total: 1800 });
    expect(byKey["groceries"]!.history.slice(-2)).toEqual([20000, 25000]);
  });

  it("checks needs, wants and savings against income", () => {
    const { split } = buildInsightsReport(input({ receipts }));
    expect(split.needs).toBe(100000 + 25000 + 4500);
    expect(split.wants).toBe(10800);
    expect(split.unsorted).toBe(3000);
    expect(split.savings).toBe(256700);
    expect(split.savingsShare).toBeCloseTo(0.64175);
  });

  it("explains what changed since last month", () => {
    const { change } = buildInsightsReport(input({ receipts }));
    expect(change.previousLabel).toBe("August 2026");
    expect(change.flexibleDelta).toBe(43300 - 21500);
    expect(change.drivers[0]).toMatchObject({ key: "dining", delta: 9300, merchant: { name: "Fox & Hound", delta: 9000 } });
    expect(change.drivers.map((d) => d.key)).toContain("groceries");
  });

  it("finds habits", () => {
    const { habits } = buildInsightsReport(input({ receipts }));
    expect(habits.topMerchants[0]).toMatchObject({ name: "Starbucks", visits: 3, total: 1800, average: 600 });
    expect(habits.topMerchants[1]).toMatchObject({ name: "Casey's", visits: 2 });
    expect(habits.smallPurchases).toEqual({ threshold: 1500, count: 4, total: 2300 });
    expect(habits.biggest.map((b) => b.amount)).toEqual([25000, 9000, 4000]);
  });

  it("builds a 12-month trend ending with the month", () => {
    const { trend } = buildInsightsReport(input({ receipts }));
    expect(trend).toHaveLength(12);
    expect(trend[11]).toMatchObject({ month: "2026-09", flexible: 43300, fixed: 100000 });
    expect(trend[0]!.month).toBe("2025-10");
  });

  it("reports pace only for the current month", () => {
    expect(buildInsightsReport(input({ receipts })).pace).toBeNull();
    const now = new Date("2026-09-10T12:00:00Z");
    const report = buildInsightsReport(input({ receipts: receipts.filter((x) => x.receiptDate <= now), now }));
    expect(report.isCurrentMonth).toBe(true);
    expect(report.daysElapsed).toBe(10);
    expect(report.pace).toEqual({
      spentSoFar: 26800,
      sameDayLastMonth: 21500,
      lastMonthTotal: 21500,
      projected: Math.round((26800 / 10) * 30),
    });
  });

  it("applies your store choices", () => {
    const rules = new Map<string, CategoryId>([["riverside plaza", "gifts"]]);
    const { categories } = buildInsightsReport(input({ receipts, rules }));
    expect(categories.find((c) => c.key === "uncategorized")).toBeUndefined();
    expect(categories.find((c) => c.key === "gifts")?.total).toBe(3000);
  });

  it("counts a bank charge matching a recurring bill once, as the bill", () => {
    const withRent = [...receipts, r("2026-09-01", "ACH RENT PAYMENT", 100000, { tags: ["bank-import"] })];
    const report = buildInsightsReport(input({ receipts: withRent }));
    expect(report.money.flexible).toBe(43300);
    expect(report.coverage.matchedToFixed).toBe(1);
  });

  it("leaves transfers and marked bills out of spending, habits and biggest purchases", () => {
    const withBank = [
      ...receipts,
      r("2026-09-10", "DISCOVER E-PAYMENT 1234", 50000, { tags: ["bank-import"] }),
      r("2026-09-12", "HSA - UMB BANK HSA Cont HSA - UMB Bank", 200000, { tags: ["bank-import"] }),
      r("2026-09-02", "Maple Apartments SIGONFILE DRSS", 90000, { tags: ["bank-import"] }),
      r("2026-09-19", "EVERGY METRO AUTOPAY 532139873232", 9000, { tags: ["bank-import"] }),
    ];
    const rules = new Map<string, StoreChoice>([
      ["maple apartments sigonfile", "bill"],
      ["evergy metro autopay", "bill"],
    ]);
    const report = buildInsightsReport(input({ receipts: withBank, rules }));
    expect(report.money.flexible).toBe(43300);
    expect(report.receiptCount).toBe(8);
    expect(report.coverage.transfers).toEqual({ count: 2, total: 250000 });
    expect(report.coverage.matchedToFixed).toBe(2);
    expect(report.habits.biggest.map((b) => b.amount)).toEqual([25000, 9000, 4000]);
    expect(report.categories.find((c) => c.key === "uncategorized")?.flexible).toBe(3000);
  });

  it("handles no income", () => {
    const report = buildInsightsReport(input({ receipts, income: [] }));
    expect(report.money.savingsRate).toBeNull();
    expect(report.split.needsShare).toBeNull();
    expect(report.insights.find((i) => i.id === "savings")).toBeUndefined();
  });

  describe("takeaways", () => {
    it("lead with the headline and point to the details", () => {
      const { insights } = buildInsightsReport(input({ receipts }));
      const ids = insights.map((i) => i.id);
      expect(ids[0]).toBe("headline");
      expect(insights[0]!.title).toBe("You spent $433 on day-to-day purchases in September 2026.");
      expect(insights[0]!.detail).toBe("That's $218 more than your recent average of $215 a month.");
      expect(insights.find((i) => i.id === "top-category")).toMatchObject({
        title: "Housing & bills is your biggest expense: $1,000, 70% of everything you spent.",
        action: { type: "category", key: "housing" },
      });
      expect(insights.find((i) => i.id === "change")?.title).toBe("Dining & coffee was up $93 from August.");
      expect(insights.find((i) => i.id === "savings")).toMatchObject({ tone: "good", action: { type: "budget-rule" } });
      expect(insights.find((i) => i.id === "regular")?.title).toBe("3 trips to Starbucks came to $18, about $6 each.");
    });

    it("mid-month, rank only day-to-day spending (a full month of bills would skew it)", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const { insights } = buildInsightsReport(input({ receipts: receipts.filter((x) => x.receiptDate <= now), now }));
      expect(insights.find((i) => i.id === "top-category")).toMatchObject({
        title: "Groceries leads your day-to-day spending so far: $250, 93%.",
        action: { type: "category", key: "groceries" },
      });
      expect(insights.find((i) => i.id === "change")).toBeUndefined();
    });

    it("ask to sort stores when a lot is uncategorized", () => {
      const lots = [...receipts, r("2026-09-25", "Mission", 40000)];
      const { insights } = buildInsightsReport(input({ receipts: lots }));
      expect(insights.find((i) => i.id === "categorize")).toMatchObject({ action: { type: "categorize" } });
    });

    it("flag receipts that couldn't be read", () => {
      const { insights } = buildInsightsReport(input({ receipts, needsReview: 2 }));
      expect(insights.find((i) => i.id === "review")?.title).toBe("2 receipts this month couldn't be read and may have the wrong amount.");
    });

    it("say so when there's nothing to show", () => {
      const { insights } = buildInsightsReport(input({ receipts: [], recurring: [] }));
      expect(insights).toEqual([expect.objectContaining({ id: "empty" })]);
    });
  });
});
