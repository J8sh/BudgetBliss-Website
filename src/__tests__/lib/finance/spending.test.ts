import type { SpendReceipt } from "@/lib/finance/allocate";
import type { StoreChoice } from "@/lib/finance/categories";
import { classifyReceipts } from "@/lib/finance/spending";

let n = 0;
function r(date: string, store: string, cents: number, bank = false): SpendReceipt {
  return { id: `r${n++}`, storeName: store, receiptDate: new Date(date), grandTotal: cents, tags: bank ? ["bank-import"] : [], lineItems: [] };
}

const kinds = (list: ReturnType<typeof classifyReceipts>) => list.map((c) => c.kind);

describe("classifyReceipts", () => {
  it("separates spending, transfers and marked bills", () => {
    const rules = new Map<string, StoreChoice>([["maple apartments sigonfile", "bill"]]);
    const out = classifyReceipts(
      [
        r("2026-10-02", "ALDI", 3000),
        r("2026-10-03", "DISCOVER E-PAYMENT 1234", 25000, true),
        r("2026-10-04", "Maple Apartments SIGONFILE DRSS", 120000, true),
      ],
      rules,
      [],
    );
    expect(kinds(out)).toEqual(["spending", "transfer", "bill"]);
  });

  it("counts a bank charge equal to a recurring bill as that bill, once per bill per month", () => {
    const out = classifyReceipts(
      [
        r("2026-10-18", "PAYPAL *SPOTIFY", 1899, true),
        r("2026-10-20", "PAYPAL *SPOTIFY", 1899, true), // a second charge the same month is real spending
        r("2026-11-18", "PAYPAL *SPOTIFY", 1899, true), // next month matches again
        r("2026-10-18", "Spotify gift card", 1899), // photographed receipts never match a bill
      ],
      new Map(),
      [1899],
    );
    expect(kinds(out)).toEqual(["bill", "spending", "bill", "spending"]);
  });

  it("allows a small difference between the bill and the charge", () => {
    expect(kinds(classifyReceipts([r("2026-10-02", "RENT CO", 100050, true)], new Map(), [100000]))).toEqual(["bill"]);
    expect(kinds(classifyReceipts([r("2026-10-02", "RENT CO", 102500, true)], new Map(), [100000]))).toEqual(["spending"]);
  });
});
