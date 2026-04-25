import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Income } from "@/lib/models/Income";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await Income.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const valid = {
  name: "Monthly Salary",
  amount: 500000, // $5,000.00 in cents
  frequency: "monthly" as const,
};

describe("Income model", () => {
  it("creates a valid income source", async () => {
    const item = await Income.create(valid);
    expect(item.name).toBe("Monthly Salary");
    expect(item.amount).toBe(500000);
    expect(item.frequency).toBe("monthly");
    expect(item.isActive).toBe(true);
  });

  it("rejects missing name", async () => {
    await expect(Income.create({ amount: 100000, frequency: "monthly" })).rejects.toThrow(/name/);
  });

  it("rejects missing amount", async () => {
    await expect(Income.create({ name: "Salary", frequency: "monthly" })).rejects.toThrow(/amount/);
  });

  it("rejects missing frequency", async () => {
    await expect(Income.create({ name: "Salary", amount: 100000 })).rejects.toThrow(/frequency/);
  });

  it("rejects invalid frequency", async () => {
    await expect(Income.create({ ...valid, frequency: "biweekly" })).rejects.toThrow();
  });

  it("rejects amount less than 1", async () => {
    await expect(Income.create({ ...valid, amount: 0 })).rejects.toThrow(/amount/);
  });

  it("accepts valid category", async () => {
    const item = await Income.create({ ...valid, category: "employment" });
    expect(item.category).toBe("employment");
  });

  it("rejects invalid category", async () => {
    await expect(Income.create({ ...valid, category: "unknown" })).rejects.toThrow();
  });

  it("stores amount as integer cents", async () => {
    const item = await Income.create(valid);
    expect(Number.isInteger(item.amount)).toBe(true);
  });

  it("sets timestamps automatically", async () => {
    const item = await Income.create(valid);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.updatedAt).toBeInstanceOf(Date);
  });

  it("stores optional notes", async () => {
    const item = await Income.create({ ...valid, notes: "ACME Corp payroll" });
    expect(item.notes).toBe("ACME Corp payroll");
  });
});
