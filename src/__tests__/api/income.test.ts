import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { Income } from "@/lib/models/Income";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "test@example.com" } }),
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "@/app/api/income/route";
import { PUT, DELETE } from "@/app/api/income/[id]/route";
import { auth } from "@/lib/auth/auth";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await Income.deleteMany({});
  (auth as jest.Mock).mockResolvedValue({ user: { email: "test@example.com" } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function makeRequest(body?: unknown, method = "GET") {
  return new NextRequest("http://localhost/api/income", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/income", () => {
  it("returns empty list and zero summary", async () => {
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

  it("normalizes monthly totals correctly", async () => {
    // $60,000/yr = $5,000/mo normalized
    await Income.create({ name: "Annual Bonus", amount: 6000000, frequency: "yearly" });
    const res = await GET();
    const json = await res.json() as { summary: { monthlyTotal: number; yearlyTotal: number } };
    expect(json.summary.monthlyTotal).toBe(Math.round(6000000 / 12));
    expect(json.summary.yearlyTotal).toBe(Math.round(6000000 / 12) * 12);
  });
});

describe("POST /api/income", () => {
  it("creates a new income source", async () => {
    const req = makeRequest({ name: "Salary", amount: 500000, frequency: "monthly", category: "employment" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json() as { name: string; amount: number; category: string };
    expect(json.name).toBe("Salary");
    expect(json.amount).toBe(500000);
    expect(json.category).toBe("employment");
    expect(await Income.countDocuments()).toBe(1);
  });

  it("returns 400 for invalid input", async () => {
    const req = makeRequest({ name: "", amount: 0, frequency: "monthly" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const req = makeRequest({ name: "Salary", amount: 500000, frequency: "monthly" }, "POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/income/[id]", () => {
  it("updates an existing income source", async () => {
    const item = await Income.create({ name: "Salary", amount: 500000, frequency: "monthly" });
    const req = makeRequest({ name: "Senior Salary", amount: 600000 }, "PUT");
    const res = await PUT(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(200);
    const json = await res.json() as { name: string; amount: number };
    expect(json.name).toBe("Senior Salary");
    expect(json.amount).toBe(600000);
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

describe("DELETE /api/income/[id]", () => {
  it("deletes an existing income source", async () => {
    const item = await Income.create({ name: "Salary", amount: 500000, frequency: "monthly" });
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(200);
    expect(await Income.countDocuments()).toBe(0);
  });

  it("returns 404 for non-existent id", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 without session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const item = await Income.create({ name: "Salary", amount: 500000, frequency: "monthly" });
    const req = makeRequest(undefined, "DELETE");
    const res = await DELETE(req, { params: Promise.resolve({ id: String(item._id) }) });
    expect(res.status).toBe(401);
  });
});
