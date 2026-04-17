import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User } from "@/lib/models/User";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.syncIndexes(); // ensure unique index on email is created before tests
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("User model", () => {
  it("creates a valid user", async () => {
    const user = await User.create({
      email: "admin@test.com",
      passwordHash: "$2b$12$hashedpassword",
    });
    expect(user.email).toBe("admin@test.com");
    expect(user.theme).toBe("system");
    expect(user.dashboardLayout).toEqual([]);
  });

  it("normalizes email to lowercase", async () => {
    const user = await User.create({
      email: "ADMIN@TEST.COM",
      passwordHash: "hash",
    });
    expect(user.email).toBe("admin@test.com");
  });

  it("enforces unique email constraint", async () => {
    await User.create({ email: "admin@test.com", passwordHash: "hash1" });
    await expect(
      User.create({ email: "admin@test.com", passwordHash: "hash2" }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it("excludes passwordHash from default queries", async () => {
    await User.create({ email: "admin@test.com", passwordHash: "secret_hash" });
    const found = await User.findOne({ email: "admin@test.com" });
    expect(found?.passwordHash).toBeUndefined();
  });

  it("includes passwordHash when explicitly selected", async () => {
    await User.create({ email: "admin@test.com", passwordHash: "secret_hash" });
    const found = await User.findOne({ email: "admin@test.com" }).select("+passwordHash");
    expect(found?.passwordHash).toBe("secret_hash");
  });

  it("saves and retrieves dashboardLayout", async () => {
    const layout = [{ i: "today-spend" as const, x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 }];
    const user = await User.create({
      email: "admin@test.com",
      passwordHash: "hash",
      dashboardLayout: layout,
    });
    expect(user.dashboardLayout).toHaveLength(1);
    expect(user.dashboardLayout[0]?.i).toBe("today-spend");
  });

  it("defaults theme to system", async () => {
    const user = await User.create({ email: "admin@test.com", passwordHash: "hash" });
    expect(user.theme).toBe("system");
  });

  it("rejects invalid theme values", async () => {
    await expect(
      User.create({ email: "admin@test.com", passwordHash: "hash", theme: "blue" as never }),
    ).rejects.toThrow();
  });

  it("sets timestamps automatically", async () => {
    const user = await User.create({ email: "admin@test.com", passwordHash: "hash" });
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});
