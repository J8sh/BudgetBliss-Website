import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "admin@test.com" } }),
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/image/optimize", () => ({
  ACCEPTED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  validateImageMagicBytes: () => true,
  optimizeForStorage: jest.fn(async (buffer: Buffer) => ({ buffer })),
  optimizeForClaude: jest.fn(async (buffer: Buffer) => buffer),
}));

jest.mock("@/lib/api/claude", () => ({
  extractReceiptData: jest.fn(),
  NotAReceiptError: class NotAReceiptError extends Error {},
  ClaudeApiError: class ClaudeApiError extends Error {},
}));

import { Receipt } from "@/lib/models/Receipt";
import { extractReceiptData } from "@/lib/api/claude";
import { POST as upload } from "@/app/api/receipts/upload/route";

let mongod: MongoMemoryServer;
let photoCounter = 0;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await Receipt.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function extracted(overrides: Record<string, unknown> = {}) {
  return {
    storeName: "Shell",
    storeAddress: "12 Main St",
    receiptDate: "2026-01-08",
    paymentMethod: "card",
    cardLastFour: "4242",
    lineItems: [{ name: "Unleaded", quantity: 1, unitPrice: 4000, totalPrice: 4000 }],
    subtotal: 4000,
    taxAmount: 0,
    grandTotal: 4000,
    ...overrides,
  };
}

async function uploadPhoto() {
  const form = new FormData();
  // Unique bytes per upload so the exact-image duplicate check doesn't kick in
  const bytes = Buffer.from(`fake-jpeg-${photoCounter++}`);
  form.append("image", new File([bytes], "receipt.jpg", { type: "image/jpeg" }));
  const res = await upload(new NextRequest("http://localhost/api/receipts/upload", { method: "POST", body: form }));
  return { status: res.status, body: (await res.json()) as { receipt: Record<string, unknown> } };
}

describe("uploading a photo of a purchase already imported from a bank statement", () => {
  it("adds the photo and details to the imported receipt instead of creating another", async () => {
    const imported = await Receipt.create({
      storeName: "SHELL OIL 5544",
      receiptDate: new Date("2026-01-09"),
      grandTotal: 4000,
      tags: ["bank-import"],
      importKey: "bank:0123456789abcdef0123456789abcdef",
    });
    (extractReceiptData as jest.Mock).mockResolvedValue(extracted());

    const { status, body } = await uploadPhoto();
    expect(status).toBe(200);
    expect(body.receipt).toMatchObject({ _id: imported._id.toString(), mergedWithImport: true, storeName: "Shell" });
    expect(await Receipt.countDocuments()).toBe(1);

    const merged = await Receipt.findById(imported._id).lean();
    expect(merged).toMatchObject({
      storeName: "Shell",
      storeAddress: "12 Main St",
      cardLastFour: "4242",
      grandTotal: 4000,
      extractionMethod: "claude",
      tags: ["bank-import"],
      importKey: "bank:0123456789abcdef0123456789abcdef",
    });
    expect(merged?.imagePath).toMatch(/\.webp$/);
    expect(merged?.lineItems).toHaveLength(1);
    expect(merged?.receiptDate.toISOString().slice(0, 10)).toBe("2026-01-08");
  });

  it("picks the closest date when several imported purchases have the same amount", async () => {
    const [, near] = await Receipt.create([
      { storeName: "SHELL A", receiptDate: new Date("2026-01-05"), grandTotal: 4000, tags: ["bank-import"] },
      { storeName: "SHELL B", receiptDate: new Date("2026-01-08"), grandTotal: 4000, tags: ["bank-import"] },
    ]);
    (extractReceiptData as jest.Mock).mockResolvedValue(extracted());
    const { body } = await uploadPhoto();
    expect(body.receipt["_id"]).toBe(near!._id.toString());
  });

  it("creates a new receipt when no imported purchase matches", async () => {
    await Receipt.create([
      { storeName: "SHELL", receiptDate: new Date("2026-01-08"), grandTotal: 3999, tags: ["bank-import"] }, // amount differs
      { storeName: "SHELL", receiptDate: new Date("2026-01-20"), grandTotal: 4000, tags: ["bank-import"] }, // too far
      { storeName: "Shell", receiptDate: new Date("2026-01-08"), grandTotal: 4000, imagePath: "old.webp", tags: ["bank-import"] }, // already has a photo
    ]);
    (extractReceiptData as jest.Mock).mockResolvedValue(extracted());
    const { status, body } = await uploadPhoto();
    expect(status).toBe(201);
    expect(body.receipt["mergedWithImport"]).toBeUndefined();
    expect(await Receipt.countDocuments()).toBe(4);
  });

  it("only attaches one photo per imported purchase", async () => {
    await Receipt.create({ storeName: "SHELL", receiptDate: new Date("2026-01-08"), grandTotal: 4000, tags: ["bank-import"] });
    (extractReceiptData as jest.Mock).mockResolvedValue(extracted());
    const first = await uploadPhoto();
    const second = await uploadPhoto();
    expect(first.status).toBe(200);
    expect(second.status).toBe(201);
    expect(await Receipt.countDocuments()).toBe(2);
  });
});
