import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Receipt } from "@/lib/models/Receipt";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Receipt.syncIndexes(); // ensure unique/sparse indexes are created before tests
});

afterEach(async () => {
  await Receipt.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const validReceipt = {
  storeName: "Whole Foods",
  receiptDate: new Date("2024-03-15"),
  grandTotal: 2450, // $24.50 in cents
  extractionMethod: "manual" as const,
};

describe("Receipt model", () => {
  it("creates a valid receipt with required fields", async () => {
    const receipt = await Receipt.create(validReceipt);
    expect(receipt.storeName).toBe("Whole Foods");
    expect(receipt.grandTotal).toBe(2450);
    expect(receipt.isDuplicate).toBe(false);
    expect(receipt.tags).toEqual([]);
    expect(receipt.lineItems).toEqual([]);
  });

  it("rejects a receipt missing storeName", async () => {
    await expect(
      Receipt.create({ receiptDate: new Date(), grandTotal: 100, extractionMethod: "manual" }),
    ).rejects.toThrow(/storeName/);
  });

  it("rejects a receipt missing grandTotal", async () => {
    await expect(
      Receipt.create({ storeName: "Store", receiptDate: new Date(), extractionMethod: "manual" }),
    ).rejects.toThrow(/grandTotal/);
  });

  it("rejects a receipt missing receiptDate", async () => {
    await expect(
      Receipt.create({ storeName: "Store", grandTotal: 100, extractionMethod: "manual" }),
    ).rejects.toThrow(/receiptDate/);
  });

  it("enforces unique imageHash constraint", async () => {
    await Receipt.create({ ...validReceipt, imageHash: "abc123", extractionMethod: "claude" });
    await expect(
      Receipt.create({ ...validReceipt, imageHash: "abc123", extractionMethod: "claude" }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("allows multiple receipts without imageHash (sparse index)", async () => {
    await Receipt.create(validReceipt);
    await Receipt.create({ ...validReceipt, storeName: "Target" });
    const count = await Receipt.countDocuments();
    expect(count).toBe(2);
  });

  it("validates cardLastFour must be exactly 4 digits", async () => {
    await expect(
      Receipt.create({ ...validReceipt, cardLastFour: "12" }),
    ).rejects.toThrow(/cardLastFour/);
    await expect(
      Receipt.create({ ...validReceipt, cardLastFour: "abcd" }),
    ).rejects.toThrow(/cardLastFour/);
  });

  it("accepts valid cardLastFour", async () => {
    const receipt = await Receipt.create({ ...validReceipt, cardLastFour: "4242" });
    expect(receipt.cardLastFour).toBe("4242");
  });

  it("stores monetary values as integers (cents)", async () => {
    const receipt = await Receipt.create({
      ...validReceipt,
      subtotal: 2000,
      taxAmount: 450,
      grandTotal: 2450,
    });
    expect(Number.isInteger(receipt.subtotal)).toBe(true);
    expect(Number.isInteger(receipt.taxAmount)).toBe(true);
    expect(Number.isInteger(receipt.grandTotal)).toBe(true);
  });

  it("stores line items with correct structure", async () => {
    const receipt = await Receipt.create({
      ...validReceipt,
      lineItems: [{ name: "Organic Milk", quantity: 2, unitPrice: 599, totalPrice: 1198 }],
    });
    expect(receipt.lineItems).toHaveLength(1);
    expect(receipt.lineItems[0]?.name).toBe("Organic Milk");
    expect(receipt.lineItems[0]?.unitPrice).toBe(599);
  });

  it("excludes extractionRaw from default queries", async () => {
    await Receipt.create({ ...validReceipt, extractionRaw: '{"storeName":"Whole Foods"}' });
    const found = await Receipt.findOne({ storeName: "Whole Foods" });
    expect(found?.extractionRaw).toBeUndefined();
  });

  it("includes extractionRaw when explicitly selected", async () => {
    await Receipt.create({ ...validReceipt, extractionRaw: '{"storeName":"Whole Foods"}' });
    const found = await Receipt.findOne({ storeName: "Whole Foods" }).select("+extractionRaw");
    expect(found?.extractionRaw).toBe('{"storeName":"Whole Foods"}');
  });

  it("sets timestamps automatically", async () => {
    const receipt = await Receipt.create(validReceipt);
    expect(receipt.createdAt).toBeInstanceOf(Date);
    expect(receipt.updatedAt).toBeInstanceOf(Date);
  });
});
