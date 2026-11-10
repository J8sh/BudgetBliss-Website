import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { email: "admin@test.com" } }),
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

import { User } from "@/lib/models/User";
import { auth } from "@/lib/auth/auth";
import { GET as getStatus } from "@/app/api/user/two-factor/route";
import { POST as postSetup } from "@/app/api/user/two-factor/setup/route";
import { POST as postEnable } from "@/app/api/user/two-factor/enable/route";
import { POST as postDisable } from "@/app/api/user/two-factor/disable/route";
import { timeStep, totpAt } from "@/lib/auth/totp";
import { resetFailureThrottles } from "@/lib/rateLimit";
import type { TwoFactorEnableResult, TwoFactorSetup, TwoFactorStatus } from "@/types/twoFactor";

const EMAIL = "admin@test.com";
const PASSWORD = "correct horse battery";
let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env["NEXTAUTH_SECRET"] = "test-secret-for-two-factor-api-0123456789";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await User.create({ email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 4) });
});

afterEach(async () => {
  await User.deleteMany({});
  resetFailureThrottles();
  (auth as jest.Mock).mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/user/two-factor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupAndEnable(): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = (await (await postSetup()).json()) as TwoFactorSetup;
  const res = await postEnable(jsonRequest({ code: totpAt(setup.secret, timeStep()) }));
  const { recoveryCodes } = (await res.json()) as TwoFactorEnableResult;
  return { secret: setup.secret, recoveryCodes };
}

describe("two-factor API auth", () => {
  it("returns 401 for every route without a session", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await getStatus()).status).toBe(401);
    expect((await postSetup()).status).toBe(401);
    expect((await postEnable(jsonRequest({ code: "123456" }))).status).toBe(401);
    expect((await postDisable(jsonRequest({ password: "x", code: "123456" }))).status).toBe(401);
  });
});

describe("setup and enable", () => {
  it("starts off", async () => {
    const status = (await (await getStatus()).json()) as TwoFactorStatus;
    expect(status).toEqual({ enabled: false, recoveryCodesRemaining: 0 });
  });

  it("returns a secret and QR code, storing only an encrypted pending secret", async () => {
    const res = await postSetup();
    expect(res.status).toBe(200);
    const body = (await res.json()) as TwoFactorSetup;
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauthUrl).toContain(`secret=${body.secret}`);
    expect(body.qrSvg).toContain("<svg");

    const user = await User.findOne({ email: EMAIL }).select("+totpPendingSecretEnc").lean();
    expect(user?.totpPendingSecretEnc).toBeDefined();
    expect(user?.totpPendingSecretEnc).not.toContain(body.secret);
    expect(user?.twoFactorEnabled).toBe(false);
  });

  it("turns on with a valid code and returns 10 recovery codes", async () => {
    const { recoveryCodes } = await setupAndEnable();
    expect(recoveryCodes).toHaveLength(10);

    const status = (await (await getStatus()).json()) as TwoFactorStatus;
    expect(status).toEqual({ enabled: true, recoveryCodesRemaining: 10 });

    const user = await User.findOne({ email: EMAIL }).select("+totpPendingSecretEnc +totpSecretEnc").lean();
    expect(user?.totpPendingSecretEnc).toBeUndefined();
    expect(user?.totpSecretEnc).toBeDefined();
  });

  it("rejects a wrong code and leaves 2FA off", async () => {
    const setup = (await (await postSetup()).json()) as TwoFactorSetup;
    const res = await postEnable(jsonRequest({ code: totpAt(setup.secret, timeStep() + 5) }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("INVALID_CODE");
    expect((await User.findOne({ email: EMAIL }).lean())?.twoFactorEnabled).toBe(false);
  });

  it("rejects enable without a started setup", async () => {
    const res = await postEnable(jsonRequest({ code: "123456" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("SETUP_EXPIRED");
  });

  it("rejects an expired setup", async () => {
    const setup = (await (await postSetup()).json()) as TwoFactorSetup;
    await User.updateOne({ email: EMAIL }, { $set: { totpPendingCreatedAt: new Date(Date.now() - 16 * 60 * 1000) } });
    const res = await postEnable(jsonRequest({ code: totpAt(setup.secret, timeStep()) }));
    expect(((await res.json()) as { code: string }).code).toBe("SETUP_EXPIRED");
  });

  it("validates the code format", async () => {
    await postSetup();
    expect((await postEnable(jsonRequest({ code: "12ab" }))).status).toBe(400);
  });

  it("won't start setup again while 2FA is on", async () => {
    await setupAndEnable();
    expect((await postSetup()).status).toBe(409);
  });

  it("throttles repeated wrong codes", async () => {
    const setup = (await (await postSetup()).json()) as TwoFactorSetup;
    const wrong = totpAt(setup.secret, timeStep() + 5);
    for (let i = 0; i < 5; i++) await postEnable(jsonRequest({ code: wrong }));
    const res = await postEnable(jsonRequest({ code: totpAt(setup.secret, timeStep()) }));
    expect(res.status).toBe(429);
  });
});

describe("disable", () => {
  it("needs the right password", async () => {
    const { recoveryCodes } = await setupAndEnable();
    const res = await postDisable(jsonRequest({ password: "nope", code: recoveryCodes[0] }));
    expect(res.status).toBe(400);
    // The recovery code wasn't spent on a failed attempt
    const status = (await (await getStatus()).json()) as TwoFactorStatus;
    expect(status.recoveryCodesRemaining).toBe(10);
  });

  it("needs a valid code", async () => {
    const { secret } = await setupAndEnable();
    const res = await postDisable(jsonRequest({ password: PASSWORD, code: totpAt(secret, timeStep() + 5) }));
    expect(res.status).toBe(400);
  });

  it("turns off with password + recovery code and clears the secrets", async () => {
    const { recoveryCodes } = await setupAndEnable();
    const res = await postDisable(jsonRequest({ password: PASSWORD, code: recoveryCodes[0] }));
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: EMAIL }).select("+totpSecretEnc +recoveryCodeHashes").lean();
    expect(user?.twoFactorEnabled).toBe(false);
    expect(user?.totpSecretEnc).toBeUndefined();
    expect(user?.recoveryCodeHashes).toEqual([]);
  });

  it("returns 409 when 2FA is already off", async () => {
    expect((await postDisable(jsonRequest({ password: PASSWORD, code: "123456" }))).status).toBe(409);
  });
});
