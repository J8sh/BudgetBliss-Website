import { allocateReceipt, splitProportionally, type SpendReceipt } from "@/lib/finance/allocate";
import type { CategoryId } from "@/lib/finance/categories";

function receipt(overrides: Partial<SpendReceipt>): SpendReceipt {
  return {
    id: "r1",
    storeName: "Walmart",
    receiptDate: new Date("2026-10-05"),
    grandTotal: 10000,
    tags: [],
    lineItems: [],
    ...overrides,
  };
}

const noRules = new Map<string, CategoryId>();

describe("splitProportionally", () => {
  it("splits exactly, with no lost or extra cents", () => {
    const parts = splitProportionally(1000, [["a", 1], ["b", 1], ["c", 1]]);
    expect(parts.reduce((s, [, v]) => s + v, 0)).toBe(1000);
    expect(parts.map(([, v]) => v).sort()).toEqual([333, 333, 334]);
  });

  it("returns nothing when all weights are zero", () => {
    expect(splitProportionally(500, [["a", 0]])).toEqual([]);
  });
});

describe("allocateReceipt", () => {
  it("uses the store's category for single-purpose stores", () => {
    const a = allocateReceipt(receipt({ storeName: "ALDI" }), noRules);
    expect(a).toMatchObject({ source: "store", parts: [{ category: "groceries", amount: 10000 }] });
  });

  it("lets your choice for a store win over everything", () => {
    const rules = new Map<string, CategoryId>([["walmart", "household"]]);
    const a = allocateReceipt(
      receipt({ lineItems: [{ name: "MILK", totalPrice: 400, category: "groceries" }] }),
      rules,
    );
    expect(a).toMatchObject({ source: "yours", parts: [{ category: "household", amount: 10000 }] });
  });

  it("splits a mixed store by item, scaling to the receipt total (tax included)", () => {
    const a = allocateReceipt(
      receipt({
        grandTotal: 10800,
        lineItems: [
          { name: "MILK", totalPrice: 6000, category: "groceries" },
          { name: "BLEACH", totalPrice: 3000, category: "household" },
          { name: "COUPON", totalPrice: -1000, category: "groceries" },
          { name: "USB CABLE", totalPrice: 2000, category: "shopping" },
        ],
      }),
      noRules,
    );
    expect(a.source).toBe("items");
    // groceries 5000, household 3000, shopping 2000 → scaled by 10800 / 10000
    expect(Object.fromEntries(a.parts.map((p) => [p.category, p.amount]))).toEqual({
      groceries: 5400,
      household: 3240,
      shopping: 2160,
    });
  });

  it("falls back to the store category when too few items are categorized", () => {
    const a = allocateReceipt(
      receipt({
        lineItems: [
          { name: "A", totalPrice: 1000, category: "household" },
          { name: "B", totalPrice: 9000 },
        ],
      }),
      noRules,
    );
    expect(a).toMatchObject({ source: "store", parts: [{ category: "groceries", amount: 10000 }] });
  });

  it("uses item categories for unrecognized stores", () => {
    const a = allocateReceipt(
      receipt({ storeName: "Corner Shop", lineItems: [{ name: "Gum", totalPrice: 300, category: "Groceries" }] }),
      noRules,
    );
    expect(a).toMatchObject({ source: "items", parts: [{ category: "groceries", amount: 10000 }] });
  });

  it("marks unknown stores without categorized items as uncategorized", () => {
    const a = allocateReceipt(receipt({ storeName: "Overland Park" }), noRules);
    expect(a).toMatchObject({ source: "none", parts: [{ category: "uncategorized", amount: 10000 }] });
  });

  it("allocates nothing for a zero total", () => {
    expect(allocateReceipt(receipt({ grandTotal: 0 }), noRules).parts).toEqual([]);
  });
});
