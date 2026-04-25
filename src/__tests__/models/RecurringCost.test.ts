import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { RecurringCost } from "@/lib/models/RecurringCost";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await RecurringCost.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const valid = {
  name: "Netflix",
  amount: 1599, // $15.99 in cents
  frequency: "monthly" as const,
};

describe("RecurringCost model", () => {
  it("creates a valid recurring cost", async () => {
    const item = await RecurringCost.create(valid);
    expect(item.name).toBe("Netflix");
    expect(item.amount).toBe(1599);
    expect(item.frequency).toBe("monthly");
    expect(item.isActive).toBe(true);
  });

  it("rejects missing name", async () => {
    await expect(RecurringCost.create({ amount: 1000, frequency: "monthly" })).rejects.toThrow(/name/);
  });

  it("rejects missing amount", async () => {
    await expect(RecurringCost.create({ name: "Rent", frequency: "monthly" })).rejects.toThrow(/amount/);
  });

  it("rejects missing frequency", async () => {
    await expect(RecurringCost.create({ name: "Rent", amount: 120000 })).rejects.toThrow(/frequency/);
  });

  it("rejects invalid frequency", async () => {
    await expect(RecurringCost.create({ ...valid, frequency: "biweekly" })).rejects.toThrow();
  });

  it("rejects amount less than 1", async () => {
    await expect(RecurringCost.create({ ...valid, amount: 0 })).rejects.toThrow(/amount/);
  });

  it("stores amount as integer cents", async () => {
    const item = await RecurringCost.create({ ...valid, amount: 12000 });
    expect(Number.isInteger(item.amount)).toBe(true);
    expect(item.amount).toBe(12000);
  });

  it("sets timestamps automatically", async () => {
    const item = await RecurringCost.create(valid);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.updatedAt).toBeInstanceOf(Date);
  });

  it("stores optional category and notes", async () => {
    const item = await RecurringCost.create({ ...valid, category: "Entertainment", notes: "Family plan" });
    expect(item.category).toBe("Entertainment");
    expect(item.notes).toBe("Family plan");
  });
});
