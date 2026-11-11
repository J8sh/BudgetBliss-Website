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
import { RecurringCost } from "@/lib/models/RecurringCost";
import { MerchantRule } from "@/lib/models/MerchantRule";
import { GET } from "@/app/api/stats/route";
import type { StatsResponse } from "@/types/stats";

let mongod: MongoMemoryServer;

/** Midnight UTC, `days` ago, the way receipt dates are stored */
function daysAgo(days: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - days));
}

const get = (query = "") => GET(new NextRequest(`http://localhost/api/stats${query}`));

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await Receipt.create([
    { storeName: "ALDI", receiptDate: daysAgo(0), grandTotal: 2500 },
    { storeName: "ALDI", receiptDate: daysAgo(40), grandTotal: 4000 },
    { storeName: "DISCOVER E-PAYMENT 1234", receiptDate: daysAgo(0), grandTotal: 50000, tags: ["bank-import"] },
    { storeName: "CITY UTILITIES", receiptDate: daysAgo(0), grandTotal: 9000, tags: ["bank-import"] },
  ]);
  await RecurringCost.create({ name: "Electric", amount: 9000, frequency: "monthly", category: "Utilities" });
});

afterEach(async () => {
  await Promise.all([Receipt.deleteMany({}), RecurringCost.deleteMany({}), MerchantRule.deleteMany({})]);
  (auth as jest.Mock).mockResolvedValue({ user: { email: "admin@test.com" } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GET /api/stats", () => {
  it("requires a session", async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);
  });

  it("defaults to 30 days and leaves out card payments and recurring bills", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as StatsResponse;
    expect(body.range).toBe("30d");
    expect(body.summary.today).toBe(2500);
    expect(body.series.bucket).toBe("day");
    expect(body.series.points).toHaveLength(30);
    expect(body.series.total).toBe(2500);
    expect(body.topStores.map((s) => s.storeName)).toEqual(["ALDI"]);
  });

  it("widens the chart for longer ranges", async () => {
    const body = (await (await get("?range=60d")).json()) as StatsResponse;
    expect(body.series.points).toHaveLength(60);
    expect(body.series.total).toBe(6500);
    expect(body.topStores[0]).toMatchObject({ storeName: "ALDI", count: 2, total: 6500 });

    const year = (await (await get("?range=1y")).json()) as StatsResponse;
    expect(year.series.bucket).toBe("month");
    expect(year.series.points).toHaveLength(12);
  });

  it("counts today by the viewer's date, not the server's UTC date", async () => {
    // A viewer whose calendar is still on yesterday (e.g. evening, west of UTC)
    const yesterday = daysAgo(1).toISOString().slice(0, 10);
    const body = (await (await get(`?today=${yesterday}`)).json()) as StatsResponse;
    expect(body.summary.today).toBe(0);
    expect(body.series.points.at(-1)!.start).toBe(yesterday);

    expect((await get("?today=not-a-date")).status).toBe(400);
  });

  it("rejects an unknown range", async () => {
    const res = await get("?range=10y");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });
});
