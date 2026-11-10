import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "admin@test.com" } }),
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/lib/auth/auth";
import { Receipt } from "@/lib/models/Receipt";
import { Income } from "@/lib/models/Income";
import { RecurringCost } from "@/lib/models/RecurringCost";
import { GET as exportCsv } from "@/app/api/export/route";
import { POST as importCsv } from "@/app/api/import/route";
import { GET as listReceipts } from "@/app/api/receipts/route";
import { parseCsv } from "@/lib/csv/csv";
import type { ImportResult } from "@/types/dataTransfer";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Receipt.syncIndexes(); // the unique importKey index is part of what's under test
});

afterEach(async () => {
  await Promise.all([Receipt.deleteMany({}), Income.deleteMany({}), RecurringCost.deleteMany({})]);
  (auth as jest.Mock).mockResolvedValue({ user: { email: "admin@test.com" } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function exportText(query: string): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await exportCsv(new NextRequest(`http://localhost/api/export?${query}`));
  return { status: res.status, text: await res.text(), headers: res.headers };
}

async function runImport(body: Record<string, unknown>): Promise<{ status: number; data: ImportResult & { error?: string } }> {
  const res = await importCsv(
    new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, data: (await res.json()) as ImportResult & { error?: string } };
}

async function seedReceipts() {
  return Receipt.create([
    {
      storeName: "=Corner Store",
      storeAddress: "1 Main St, Springfield",
      receiptDate: new Date("2026-01-05"),
      paymentMethod: "card",
      cardLastFour: "0123",
      subtotal: 1000,
      taxAmount: 85,
      grandTotal: 1085,
      tags: ["groceries", "weekly"],
      notes: 'Said "thanks"',
      extractionMethod: "claude",
      lineItems: [
        { name: "Milk", quantity: 2, unitPrice: 250, totalPrice: 500, category: "dairy" },
        { name: "Coupon", quantity: 1, unitPrice: -100, totalPrice: -100 },
        { name: "Bread", quantity: 1, unitPrice: 600, totalPrice: 600 },
      ],
    },
    { storeName: "Gas Station", receiptDate: new Date("2026-02-10"), grandTotal: 4000, extractionMethod: "manual" },
  ]);
}

describe("auth", () => {
  it("returns 401 without a session", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await exportText("type=receipts")).status).toBe(401);
    expect((await runImport({ csv: "a\n1" })).status).toBe(401);
  });
});

describe("GET /api/export", () => {
  it("exports receipts as a CSV download, guarding formula-like text", async () => {
    await seedReceipts();
    const { status, text, headers } = await exportText("type=receipts");
    expect(status).toBe(200);
    expect(headers.get("Content-Type")).toContain("text/csv");
    expect(headers.get("Content-Disposition")).toMatch(/attachment; filename="budgetbliss-receipts-.*\.csv"/);

    const { headers: cols, rows } = parseCsv(text);
    expect(cols[0]).toBe("id");
    expect(rows).toHaveLength(2);
    const first = Object.fromEntries(cols.map((c, i) => [c, rows[0]![i]]));
    expect(first).toMatchObject({
      date: "2026-01-05",
      store: "'=Corner Store",
      store_address: "1 Main St, Springfield",
      card_last_four: "0123",
      subtotal: "10.00",
      tax: "0.85",
      total: "10.85",
      tags: "groceries; weekly",
      notes: 'Said "thanks"',
      extraction_method: "claude",
    });
  });

  it("filters receipts by date range", async () => {
    await seedReceipts();
    const { text } = await exportText("type=receipts&from=2026-02-01&to=2026-02-10");
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]![2]).toBe("Gas Station");
  });

  it("exports one row per line item, including negative amounts", async () => {
    await seedReceipts();
    const { rows } = parseCsv((await exportText("type=line-items")).text);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(expect.arrayContaining(["Coupon", "-1.00"]));
  });

  it("exports income and recurring costs", async () => {
    await Income.create({ name: "Salary", amount: 500000, frequency: "monthly", category: "employment" });
    await RecurringCost.create({ name: "Netflix", amount: 1599, frequency: "monthly", isActive: false });
    const income = parseCsv((await exportText("type=income")).text);
    expect(income.headers[1]).toBe("income_source");
    expect(income.rows[0]).toEqual(expect.arrayContaining(["Salary", "5000.00", "monthly", "employment", "true"]));
    const recurring = parseCsv((await exportText("type=recurring")).text);
    expect(recurring.rows[0]).toEqual(expect.arrayContaining(["Netflix", "15.99", "false"]));
  });

  it("rejects bad options", async () => {
    expect((await exportText("type=nope")).status).toBe(400);
    expect((await exportText("type=receipts&from=2026-03-01&to=2026-01-01")).status).toBe(400);
  });
});

describe("POST /api/import: BudgetBliss files", () => {
  it("restores an export into an empty database with the same ids and data", async () => {
    const original = await seedReceipts();
    const receiptsCsv = (await exportText("type=receipts")).text;
    const itemsCsv = (await exportText("type=line-items")).text;
    await Receipt.deleteMany({});

    const preview = await runImport({ csv: receiptsCsv });
    expect(preview.data).toMatchObject({ kind: "receipts", dryRun: true, written: 0 });
    expect(preview.data.counts.create).toBe(2);
    expect(await Receipt.countDocuments()).toBe(0);

    const applied = await runImport({ csv: receiptsCsv, dryRun: false });
    expect(applied.data.written).toBe(2);
    const items = await runImport({ csv: itemsCsv, dryRun: false });
    expect(items.data).toMatchObject({ kind: "line-items", written: 3 });

    const restored = await Receipt.findById(original[0]!._id).lean();
    expect(restored).toMatchObject({
      storeName: "=Corner Store",
      cardLastFour: "0123",
      grandTotal: 1085,
      tags: ["groceries", "weekly"],
      notes: 'Said "thanks"',
      extractionMethod: "claude",
    });
    expect(restored?.lineItems.map((i) => [i.name, i.quantity, i.totalPrice, i.category])).toEqual([
      ["Milk", 2, 500, "dairy"],
      ["Coupon", 1, -100, undefined],
      ["Bread", 1, 600, undefined],
    ]);
  });

  it("updates existing receipts by id, and clears emptied cells", async () => {
    const [receipt] = await seedReceipts();
    const { headers, rows } = parseCsv((await exportText("type=receipts")).text);
    const col = (name: string) => headers.indexOf(name);
    const row = rows.find((r) => r[0] === receipt!._id.toString())!;
    row[col("total")] = "11.00";
    row[col("notes")] = "";
    row[col("card_last_four")] = "123"; // as Excel would show 0123

    const csv = [headers.join(","), row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")].join("\n");
    const result = await runImport({ csv, dryRun: false });
    expect(result.data.counts).toMatchObject({ update: 1, create: 0, error: 0 });

    const updated = await Receipt.findById(receipt!._id).lean();
    expect(updated?.grandTotal).toBe(1100);
    expect(updated?.notes).toBeUndefined();
    expect(updated?.cardLastFour).toBe("0123");
    expect(updated?.lineItems).toHaveLength(3); // items untouched by a receipts import
  });

  it("skips rows without an id that match an existing receipt, unless asked not to", async () => {
    await seedReceipts();
    const csv = "date,store,total\n2026-02-10,gas station,40.00\n2026-02-11,New Place,5.00\n";
    const skipped = await runImport({ csv });
    expect(skipped.data.counts).toMatchObject({ create: 1, duplicate: 1 });

    const kept = await runImport({ csv, skipDuplicates: false });
    expect(kept.data.counts).toMatchObject({ create: 2, duplicate: 0 });
  });

  it("reports row errors with line numbers and still imports the good rows", async () => {
    const csv = "date,store,total,payment_method\n2026-01-01,A,1.00,card\nbad,B,1.00,\n2026-01-02,,1.00,\n2026-01-03,D,-5,\n2026-01-04,E,2.00,bitcoin\n";
    const { data } = await runImport({ csv, dryRun: false });
    expect(data.counts).toMatchObject({ create: 1, error: 4 });
    expect(data.rows.filter((r) => r.status === "error").map((r) => r.line)).toEqual([3, 4, 5, 6]);
    expect(await Receipt.countDocuments()).toBe(1);
  });

  it("rejects line items for receipts that don't exist", async () => {
    const csv = "receipt_id,item,total_price\n0123456789abcdef01234567,Milk,1.00\n";
    const { data } = await runImport({ csv });
    expect(data.counts.error).toBe(1);
    expect(data.rows[0]!.message).toMatch(/Import the receipts file first/);
  });

  it("holds back a receipt's items when one of its rows is bad", async () => {
    const [receipt] = await seedReceipts();
    const id = receipt!._id.toString();
    const csv = `receipt_id,item,total_price\n${id},Eggs,3.00\n${id},,1.00\n`;
    const { data } = await runImport({ csv, dryRun: false });
    expect(data.counts).toMatchObject({ skip: 1, error: 1, update: 0 });
    expect((await Receipt.findById(id).lean())?.lineItems).toHaveLength(3);
  });

  it("round-trips income and recurring costs, updating by id", async () => {
    const salary = await Income.create({ name: "Salary", amount: 500000, frequency: "monthly", category: "employment" });
    const csv = (await exportText("type=income")).text.replace("5000.00", "5200.00");
    const { data } = await runImport({ csv, dryRun: false });
    expect(data).toMatchObject({ kind: "income", counts: { update: 1 } });
    expect((await Income.findById(salary._id).lean())?.amount).toBe(520000);

    const recurringCsv = "recurring_cost,amount,frequency,category\nGym,29.99,monthly,Health\nGym,29.99,monthly,Health\n";
    const first = await runImport({ csv: recurringCsv, dryRun: false });
    // The second identical row in the same file is flagged, not imported
    expect(first.data).toMatchObject({ kind: "recurring", written: 1, counts: { create: 1, duplicate: 1 } });
    const again = await runImport({ csv: recurringCsv });
    expect(again.data.counts).toMatchObject({ create: 0, duplicate: 2 });
  });

  it("validates income categories and frequencies", async () => {
    const csv = "income_source,amount,frequency,category\nA,10,daily,\nB,10,monthly,lottery\n";
    const { data } = await runImport({ csv });
    expect(data.counts.error).toBe(2);
  });
});

describe("POST /api/import: bank statements", () => {
  const STATEMENT = `Transaction Date,Description,Amount
01/05/2026,STARBUCKS 1234,-5.25
01/06/2026,PAYMENT THANK YOU,300.00
02/09/2026,SHELL OIL,-40.00
02/12/2026,=HYPERLINK("x"),-1.00
`;

  it("guesses the mapping, previews, and imports purchases as receipts", async () => {
    const preview = await runImport({ csv: STATEMENT });
    expect(preview.data.kind).toBe("bank");
    expect(preview.data.mapping).toMatchObject({ date: "Transaction Date", amount: "Amount", spendingIs: "negative" });
    expect(preview.data.counts).toMatchObject({ create: 3, skip: 1 });

    const applied = await runImport({ csv: STATEMENT, dryRun: false });
    expect(applied.data.written).toBe(3);
    const receipts = await Receipt.find({}).sort({ receiptDate: 1 }).lean();
    expect(receipts.map((r) => [r.storeName, r.grandTotal, r.tags])).toEqual([
      ["STARBUCKS 1234", 525, ["bank-import"]],
      ["SHELL OIL", 4000, ["bank-import"]],
      ['=HYPERLINK("x")', 100, ["bank-import"]],
    ]);
  });

  it("skips purchases you already have (same amount within 3 days), each matched once", async () => {
    await Receipt.create({ storeName: "Shell", receiptDate: new Date("2026-02-10"), grandTotal: 4000 });
    const csv = "Date,Description,Amount\n02/09/2026,SHELL OIL,-40.00\n02/09/2026,SHELL OIL,-40.00\n02/20/2026,SHELL OIL,-40.00\n";
    const { data } = await runImport({ csv });
    expect(data.counts).toMatchObject({ duplicate: 1, create: 2 });
    expect(data.rows[0]!.message).toBe("Matches Shell on 2026-02-10");
  });

  it("re-importing the same statement imports nothing new", async () => {
    await runImport({ csv: STATEMENT, dryRun: false });
    const again = await runImport({ csv: STATEMENT, dryRun: false });
    expect(again.data.counts).toMatchObject({ create: 0, duplicate: 3 });
    expect(await Receipt.countDocuments()).toBe(3);
  });

  it("uses a mapping the user chose", async () => {
    const csv = "When,What,Out,In\n2026-01-05,Coffee,4.50,\n2026-01-06,Pay,,100.00\n";
    const auto = await runImport({ csv });
    expect(auto.data.kind).toBe("bank");

    const { data } = await runImport({
      csv,
      kind: "bank",
      mapping: { date: "When", description: "What", debit: "Out", credit: "In", spendingIs: "negative", dateFormat: "auto" },
    });
    expect(data.counts).toMatchObject({ create: 1, skip: 1 });
  });

  it("asks for a mapping instead of guessing wrong when columns can't be found", async () => {
    const { data } = await runImport({ csv: "foo,bar\n1,2\n" });
    expect(data.kind).toBe("bank");
    expect(data.counts.create).toBe(0);
    expect(data.rows[0]!.message).toMatch(/Choose the column/);
  });
});

describe("POST /api/import: file problems", () => {
  it("rejects empty files and files over the row limit", async () => {
    expect((await runImport({ csv: "" })).status).toBe(400);
    expect((await runImport({ csv: "date,store,total\n" })).data.error).toMatch(/no rows/);
    const big = "date,store,total\n" + "2026-01-01,X,1.00\n".repeat(5001);
    const res = await runImport({ csv: big });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/limit is 5000/);
  });
});

describe("no duplicates across files and existing data", () => {
  const JAN = `Date,Description,Amount
01/05/2026,STARBUCKS 1234,-5.25
01/05/2026,STARBUCKS 1234,-5.25
01/09/2026,SHELL OIL,-40.00
`;
  // An overlapping statement: same January rows (one with different spacing/case), plus February
  const JAN_FEB = `Date,Description,Amount
01/05/2026,Starbucks  1234,-5.25
01/05/2026,STARBUCKS 1234,-5.25
01/09/2026,SHELL OIL,-40.00
02/02/2026,TRADER JOES,-61.30
`;

  it("keeps repeated identical charges on one statement (two coffees), once each", async () => {
    const first = await runImport({ csv: JAN, dryRun: false });
    expect(first.data.written).toBe(3);
    expect(first.data.rows[1]!.message).toMatch(/Same as line 2/);
  });

  it("imports only the new rows from an overlapping statement", async () => {
    await runImport({ csv: JAN, dryRun: false });
    const { data } = await runImport({ csv: JAN_FEB, dryRun: false });
    expect(data.counts).toMatchObject({ create: 1, duplicate: 3 });
    expect(data.rows.slice(0, 3).every((r) => r.message?.startsWith("Already imported on"))).toBe(true);
    expect(await Receipt.countDocuments()).toBe(4);
  });

  it("never re-imports an already-imported row, even with 'skip duplicates' off", async () => {
    await runImport({ csv: JAN, dryRun: false });
    const { data } = await runImport({ csv: JAN, dryRun: false, skipDuplicates: false });
    expect(data.counts).toMatchObject({ create: 0, duplicate: 3 });
    expect(await Receipt.countDocuments()).toBe(3);
  });

  it("imports a third identical charge that a later statement adds", async () => {
    await runImport({ csv: JAN, dryRun: false });
    const three = `Date,Description,Amount
01/05/2026,STARBUCKS 1234,-5.25
01/05/2026,STARBUCKS 1234,-5.25
01/05/2026,STARBUCKS 1234,-5.25
`;
    const { data } = await runImport({ csv: three, dryRun: false });
    expect(data.counts).toMatchObject({ duplicate: 2, create: 1 });
    expect(await Receipt.countDocuments({ storeName: "STARBUCKS 1234" })).toBe(3);
  });

  it("two imports of the same file at once still write each row once", async () => {
    const [a, b] = await Promise.all([runImport({ csv: JAN, dryRun: false }), runImport({ csv: JAN, dryRun: false })]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await Receipt.countDocuments()).toBe(3);
    expect(a.data.written + b.data.written).toBe(3);
  });

  it("matches statement rows against receipts entered other ways, each receipt once", async () => {
    await Receipt.create({ storeName: "Shell", receiptDate: new Date("2026-01-08"), grandTotal: 4000, imagePath: "x.webp" });
    const { data } = await runImport({ csv: JAN });
    const shell = data.rows.find((r) => r.description === "SHELL OIL")!;
    expect(shell).toMatchObject({ status: "duplicate", message: "Matches Shell on 2026-01-08" });
  });

  it("keeps import fingerprints through export and restore", async () => {
    await runImport({ csv: JAN, dryRun: false });
    const backup = (await exportText("type=receipts")).text;
    expect(parseCsv(backup).headers).toContain("import_key");
    await Receipt.deleteMany({});

    const restored = await runImport({ csv: backup, dryRun: false });
    expect(restored.data.written).toBe(3);
    const again = await runImport({ csv: JAN });
    expect(again.data.counts).toMatchObject({ create: 0, duplicate: 3 });
    expect(again.data.rows.every((r) => r.message?.startsWith("Already imported on"))).toBe(true);
  });

  it("flags identical rows in a hand-made receipts file and never imports that file twice", async () => {
    const csv = `date,store,total
2026-03-01,Farmers Market,12.00
2026-03-01,farmers market,12.00
`;
    const preview = await runImport({ csv });
    expect(preview.data.counts).toMatchObject({ create: 1, duplicate: 1 });
    expect(preview.data.rows[1]!.message).toBe("Same as line 2 in this file");

    const forced = await runImport({ csv, dryRun: false, skipDuplicates: false });
    expect(forced.data.written).toBe(2);
    const again = await runImport({ csv, dryRun: false, skipDuplicates: false });
    expect(again.data.counts).toMatchObject({ create: 0, duplicate: 2 });
    expect(await Receipt.countDocuments()).toBe(2);
  });

  it("flags identical income rows within one file", async () => {
    const csv = `income_source,amount,frequency
Rent from Sam,500,monthly
Rent from Sam,500,monthly
`;
    const { data } = await runImport({ csv });
    expect(data.counts).toMatchObject({ create: 1, duplicate: 1 });
  });

  it("returns date, description and amount for sorting the preview", async () => {
    const { data } = await runImport({ csv: JAN });
    expect(data.rows[2]).toMatchObject({ date: "2026-01-09", description: "SHELL OIL", amountCents: 4000 });
  });
});

describe("GET /api/receipts?source=", () => {
  it("separates photos, bank imports and typed-in receipts", async () => {
    await Receipt.create([
      { storeName: "Photo", receiptDate: new Date("2026-01-01"), grandTotal: 100, imagePath: "a.webp" },
      { storeName: "Typed", receiptDate: new Date("2026-01-01"), grandTotal: 200 },
      { storeName: "Bank", receiptDate: new Date("2026-01-01"), grandTotal: 300, tags: ["bank-import"] },
      { storeName: "Bank+photo", receiptDate: new Date("2026-01-01"), grandTotal: 400, tags: ["bank-import"], imagePath: "b.webp" },
    ]);
    const names = async (source: string) => {
      const res = await listReceipts(new NextRequest(`http://localhost/api/receipts?source=${source}&sortBy=grandTotal&sortOrder=asc`));
      return ((await res.json()) as { receipts: Array<{ storeName: string }> }).receipts.map((r) => r.storeName);
    };
    expect(await names("photo")).toEqual(["Photo", "Bank+photo"]);
    expect(await names("bank")).toEqual(["Bank"]);
    expect(await names("manual")).toEqual(["Typed"]);
  });
});
