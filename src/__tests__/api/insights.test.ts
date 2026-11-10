import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "admin@test.com" } }),
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/api/categorizeItems", () => ({
  MAX_ITEMS_PER_CALL: 120,
  CategorizeError: class CategorizeError extends Error {},
  categorizeItems: jest.fn(),
}));

import { auth } from "@/lib/auth/auth";
import { categorizeItems, CategorizeError } from "@/lib/api/categorizeItems";
import { Receipt } from "@/lib/models/Receipt";
import { Income } from "@/lib/models/Income";
import { RecurringCost } from "@/lib/models/RecurringCost";
import { MerchantRule } from "@/lib/models/MerchantRule";
import { GET as getInsights } from "@/app/api/insights/route";
import { GET as getMerchants, PUT as putMerchant } from "@/app/api/insights/merchants/route";
import { GET as getPending, POST as categorize } from "@/app/api/insights/categorize-items/route";
import type { InsightsReport, MerchantSummary } from "@/types/insights";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await Receipt.create([
    { storeName: "ALDI", receiptDate: new Date("2026-09-02"), grandTotal: 25000 },
    { storeName: "Starbucks Coffee", receiptDate: new Date("2026-09-05"), grandTotal: 600 },
    { storeName: "Riverside Plaza", receiptDate: new Date("2026-09-20"), grandTotal: 3000 },
    { storeName: "Shawnee", receiptDate: new Date("2026-09-21"), grandTotal: 1000, extractionMethod: "failed" },
    {
      storeName: "Walmart Supercenter",
      receiptDate: new Date("2026-09-15"),
      grandTotal: 3240,
      lineItems: [
        { name: "GV MILK", quantity: 1, unitPrice: 1000, totalPrice: 1000 },
        { name: "BLEACH", quantity: 1, unitPrice: 2000, totalPrice: 2000 },
      ],
    },
    { storeName: "ALDI", receiptDate: new Date("2026-08-02"), grandTotal: 20000 },
  ]);
  await Income.create({ name: "Job", amount: 400000, frequency: "monthly", category: "employment" });
  await RecurringCost.create({ name: "Rent", amount: 100000, frequency: "monthly", category: "Rent" });
});

afterEach(async () => {
  await Promise.all([Receipt.deleteMany({}), Income.deleteMany({}), RecurringCost.deleteMany({}), MerchantRule.deleteMany({})]);
  (auth as jest.Mock).mockResolvedValue({ user: { email: "admin@test.com" } });
  (categorizeItems as jest.Mock).mockReset();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function insights(month = "2026-09"): Promise<{ status: number; body: InsightsReport }> {
  const res = await getInsights(new NextRequest(`http://localhost/api/insights?month=${month}`));
  return { status: res.status, body: (await res.json()) as InsightsReport };
}

async function merchants(): Promise<MerchantSummary[]> {
  return ((await (await getMerchants()).json()) as { merchants: MerchantSummary[] }).merchants;
}

function put(body: unknown) {
  return putMerchant(
    new NextRequest("http://localhost/api/insights/merchants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("auth", () => {
  it("returns 401 without a session on every route", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await insights()).status).toBe(401);
    expect((await getMerchants()).status).toBe(401);
    expect((await put({ key: "x", category: "fun" })).status).toBe(401);
    expect((await getPending()).status).toBe(401);
    expect((await categorize()).status).toBe(401);
  });
});

describe("GET /api/insights", () => {
  it("builds the month's report from the database", async () => {
    const { status, body } = await insights();
    expect(status).toBe(200);
    expect(body.label).toBe("September 2026");
    expect(body.money).toMatchObject({ income: 400000, fixed: 100000, flexible: 32840 });
    expect(body.coverage.needsReview).toBe(1);
    expect(body.categories.find((c) => c.key === "groceries")).toMatchObject({ total: 25000 + 3240, previous: 20000 });
    expect(body.availableMonths).toEqual(["2026-09", "2026-08"]);
    expect(body.insights.length).toBeGreaterThan(0);
  });

  it("rejects a malformed month", async () => {
    expect((await insights("2026-13")).status).toBe(400);
    expect((await insights("sept")).status).toBe(400);
  });
});

describe("store categories", () => {
  it("lists stores with how they're categorized, biggest first", async () => {
    const list = await merchants();
    expect(list[0]).toMatchObject({ key: "aldi", name: "ALDI", category: "groceries", source: "store", visits: 2, total: 45000 });
    expect(list.find((m) => m.key === "riverside plaza")).toMatchObject({ category: "uncategorized", source: "none" });
    expect(list.find((m) => m.key === "walmart")).toMatchObject({ name: "Walmart", mixed: true, source: "store" });
  });

  it("applies your choice to every receipt from the store, and can undo it", async () => {
    expect((await put({ key: "riverside plaza", category: "gifts" })).status).toBe(200);
    expect((await merchants()).find((m) => m.key === "riverside plaza")).toMatchObject({ category: "gifts", source: "yours" });
    expect((await insights()).body.categories.find((c) => c.key === "gifts")?.total).toBe(3000);

    await put({ key: "riverside plaza", category: null });
    expect((await merchants()).find((m) => m.key === "riverside plaza")).toMatchObject({ category: "uncategorized", source: "none" });
  });

  it("accepts not spending and recurring bill, and leaves those out of the report", async () => {
    await Receipt.create({ storeName: "Maple Apartments SIGONFILE DRSS", receiptDate: new Date("2026-09-02"), grandTotal: 120000, tags: ["bank-import"] });
    const before = (await insights()).body.money.flexible;

    expect((await put({ key: "maple apartments sigonfile", category: "bill" })).status).toBe(200);
    const after = await insights();
    expect(after.body.money.flexible).toBe(before - 120000);
    expect(after.body.coverage.matchedToFixed).toBe(1);
    expect((await merchants()).find((m) => m.key === "maple apartments sigonfile")).toMatchObject({
      name: "Maple Apartments Sigonfile",
      category: "bill",
      source: "yours",
    });

    expect((await put({ key: "riverside plaza", category: "transfer" })).status).toBe(200);
    expect((await insights()).body.coverage.transfers).toEqual({ count: 1, total: 3000 });
  });

  it("shows recognized transfers as not spending without any rule", async () => {
    await Receipt.create({ storeName: "DISCOVER E-PAYMENT 1234", receiptDate: new Date("2026-09-09"), grandTotal: 25000, tags: ["bank-import"] });
    expect((await merchants()).find((m) => m.key === "discover e-payment")).toMatchObject({ category: "transfer", source: "store", suggested: "transfer" });
    expect((await insights()).body.money.flexible).toBe(32840);
  });

  it("validates the category", async () => {
    expect((await put({ key: "aldi", category: "snacks" })).status).toBe(400);
    expect((await put({ key: "", category: "fun" })).status).toBe(400);
  });
});

describe("sorting items with AI", () => {
  it("counts only items whose category would change the numbers", async () => {
    const res = await getPending();
    // Walmart's two items; ALDI/Starbucks are single-category stores; others have no items
    expect(await res.json()).toEqual({ remaining: 2, batchSize: 120 });
  });

  it("skips stores you've already categorized", async () => {
    await put({ key: "walmart", category: "groceries" });
    expect(await (await getPending()).json()).toMatchObject({ remaining: 0 });
  });

  it("writes Claude's categories onto the line items and splits the receipt", async () => {
    (categorizeItems as jest.Mock).mockImplementation(async (items: Array<{ ref: string; name: string }>) => {
      return new Map(items.map((i) => [i.ref, i.name === "BLEACH" ? "household" : "groceries"]));
    });

    const res = await categorize();
    expect(await res.json()).toEqual({ categorized: 2, remaining: 0 });
    const sent = (categorizeItems as jest.Mock).mock.calls[0][0] as Array<{ name: string; store: string }>;
    expect(sent.map((i) => i.name).sort()).toEqual(["BLEACH", "GV MILK"]);
    expect(sent[0]!.store).toBe("Walmart Supercenter");

    const walmart = await Receipt.findOne({ storeName: "Walmart Supercenter" }).lean();
    expect(walmart?.lineItems.map((i) => i.category)).toEqual(["groceries", "household"]);

    const { body } = await insights();
    expect(body.categories.find((c) => c.key === "household")?.flexible).toBe(2160);
  });

  it("reports when Claude isn't available, without writing anything", async () => {
    (categorizeItems as jest.Mock).mockRejectedValue(new CategorizeError("down"));
    const res = await categorize();
    expect(res.status).toBe(503);
    const walmart = await Receipt.findOne({ storeName: "Walmart Supercenter" }).lean();
    expect(walmart?.lineItems.every((i) => !i.category)).toBe(true);
  });
});
