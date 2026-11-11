import type { SpendReceipt } from "@/lib/finance/allocate";
import { classifyReceipts } from "@/lib/finance/spending";
import { buildStats, statsWindowStart, STAT_RANGES } from "@/lib/finance/stats";

let n = 0;
function r(date: string, store: string, cents: number, bank = false): SpendReceipt {
  return { id: `r${n++}`, storeName: store, receiptDate: new Date(date), grandTotal: cents, tags: bank ? ["bank-import"] : [], lineItems: [] };
}

// Tuesday, Nov 10 2026
const NOW = new Date("2026-11-10T18:00:00Z");

const receipts = [
  r("2026-01-15", "ALDI", 5000),
  r("2026-08-20", "ALDI", 4000),
  r("2026-10-05", "WM SUPERCENTER #0001", 10000, true),
  r("2026-10-20", "Walmart", 6000),
  r("2026-11-02", "Maple Apartments SIGONFILE H1YS", 120000, true),
  r("2026-11-03", "DISCOVER E-PAYMENT 1234", 25000, true),
  r("2026-11-08", "Starbucks Coffee", 700), // Sunday: start of this week
  r("2026-11-10", "CASEYS #0002", 3000, true), // today
];
const classified = classifyReceipts(receipts, new Map([["maple apartments sigonfile", "bill"]]), []);

describe("buildStats", () => {
  it("totals only day-to-day spending for today, this week, month and year", () => {
    const stats = buildStats(classified, NOW, "30d");
    expect(stats.summary).toEqual({
      today: 3000,
      week: 3700,
      month: 3700, // rent (marked as a bill) and the card payment are left out
      year: 5000 + 4000 + 10000 + 6000 + 700 + 3000,
    });
  });

  it("charts the last 30 days day by day", () => {
    const { series } = buildStats(classified, NOW, "30d");
    expect(series.bucket).toBe("day");
    expect(series.points).toHaveLength(30);
    expect(series.points[29]).toMatchObject({ start: "2026-11-10", label: "Nov 10", total: 3000, count: 1, partial: false });
    expect(series.points[0]!.start).toBe("2026-10-12");
    expect(series.total).toBe(6000 + 700 + 3000);
    expect(series.average).toBe(Math.round((6000 + 700 + 3000) / 30));
  });

  it("uses weeks for 3 and 6 months, leaving the current week out of the average", () => {
    const { series } = buildStats(classified, NOW, "3m");
    expect(series.bucket).toBe("week");
    expect(series.points).toHaveLength(13);
    const last = series.points[12]!;
    expect(last).toMatchObject({ start: "2026-11-08", partial: true, total: 3700, fullLabel: "Week of Nov 8, 2026" });
    expect(series.points[0]!.start).toBe("2026-08-16");
    expect(series.average).toBe(Math.round((4000 + 10000 + 6000) / 12));
    expect(buildStats(classified, NOW, "6m").series.points).toHaveLength(26);
  });

  it("uses months for 1 year", () => {
    const { series } = buildStats(classified, NOW, "1y");
    expect(series.bucket).toBe("month");
    expect(series.points.map((p) => p.label)).toEqual(["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(series.points[11]).toMatchObject({ fullLabel: "November 2026", total: 3700, partial: true });
    expect(series.points[10]!.total).toBe(16000);
    expect(series.average).toBe(Math.round((5000 + 4000 + 16000) / 11));
  });

  it("lists top stores in the range, grouping spellings of the same store", () => {
    const { topStores } = buildStats(classified, NOW, "60d");
    expect(topStores[0]).toEqual({ key: "walmart", storeName: "Walmart", total: 16000, count: 2 });
    expect(topStores.map((s) => s.storeName)).not.toContain("Maple Apartments Sigonfile");
    expect(buildStats(classified, NOW, "30d").topStores.map((s) => s.storeName)).toEqual(["Walmart", "Casey's", "Starbucks"]);
  });
});

describe("statsWindowStart", () => {
  it("covers both the chart range and the year-to-date total", () => {
    expect(statsWindowStart(NOW, "30d").toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(statsWindowStart(new Date("2026-02-10T00:00:00Z"), "1y").toISOString().slice(0, 10)).toBe("2025-03-01");
  });

  it("has a label for every range", () => {
    expect(Object.values(STAT_RANGES).every((r) => r.label && r.count > 0)).toBe(true);
  });
});
