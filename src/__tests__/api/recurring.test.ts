import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { RecurringCost } from "@/lib/models/RecurringCost";

// Mock auth to return a valid session by default
jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

// Mock connectDB to use the in-memory connection
jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

// Import route handlers after mocks are in place
import { GET, POST } from "@/app/api/recurring/route";
import { PUT, DELETE } from "@/app/api/recurring/[id]/route";

import { auth } from "@/lib/auth/auth";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await RecurringCost.deleteMany({});
  (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeRequest(body?: unknown, method = "GET") {
  return new NextRequest("http://localhost/api/recurring", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/recurring", () => {
  it("returns empty list and zero summary when no items", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; summary: { monthlyTotal: number; activeCount: number } };
    expect(json.items).toHaveLength(0);
    expect(json.summary.monthlyTotal).toBe(0);
    expect(json.summary.activeCount).toBe(0);
  });

  it("returns 401 without session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns items with computed summary", async () => {
    await RecurringCost.create({ name: "Netflix", amount: 1599, frequency: "monthly" });
    await RecurringCost.create({ name: "Insurance", amount: 120000, frequency: "yearly" });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; summary: { monthlyTotal: number; yearlyTotal: number; activeCount: number } };
    expect(json.items).toHaveLength(2);
    expect(json.summary.activeCount).toBe(2);
    // Netflix $15.99/mo + Insurance $1200/yr (~$100/mo)
    expect(json.summary.monthlyTotal).toBeGreaterThan(0);
  });
});

describe("POST /api/recurring", () => {
  it("creates a new recurring cost", async () => {
    const req = makeRequest({ name: "Spotify", amount: 999, frequency: "monthly" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json() as { name: string; amount: number };
    expect(json.name).toBe("Spotify");
    expect(json.amount).toBe(999);
    const count = await RecurringCost.countDocuments();
    expect(count).toBe(1);
  });

  it("returns 400 for invalid input", async () => {
    const req = makeRequest({ name: "", amount: -1, frequency: "monthly" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const req = makeRequest({ name: "X", amount: 100, frequency: "monthly" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/recurring/[id]", () => {
  it("updates an existing item", async () => {
    const item = await RecurringCost.create({ name: "Netflix", amount: 1599, frequency: "monthly" });
    const req = makeRequest({ name: "Netflix Premium", amount: 2299 }, "PUT");
    const res = await PUT(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(200);
    const json = await res.json() as { name: string; amount: number };
    expect(json.name).toBe("Netflix Premium");
    expect(json.amount).toBe(2299);
  });

  it("returns 404 for non-existent id", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const req = makeRequest({ name: "X" }, "PUT");
    const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ObjectId", async () => {
    const req = makeRequest({ name: "X" }, "PUT");
    const res = await PUT(req, { params: Promise.resolve({ id: "not-an-id" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/recurring/[id]", () => {
  it("deletes an existing item", async () => {
    const item = await RecurringCost.create({ name: "Netflix", amount: 1599, frequency: "monthly" });
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(200);
    const count = await RecurringCost.countDocuments();
    expect(count).toBe(0);
  });

  it("returns 404 for non-existent id", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 without session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const item = await RecurringCost.create({ name: "Netflix", amount: 1599, frequency: "monthly" });
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(401);
  });
});
