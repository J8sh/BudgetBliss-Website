import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// next-auth ships ESM only; the login flow only needs its CredentialsSignin base class
jest.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));

jest.mock("@/lib/db/mongoose", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

import { User } from "@/lib/models/User";
import {
  authorizeCredentials,
  clientIp,
  InvalidTwoFactorCodeError,
  LOGIN_MAX_FAILURES,
  LoginThrottledError,
  TwoFactorRequiredError,
} from "@/lib/auth/authorize";
import { TWO_FACTOR_MAX_FAILURES } from "@/lib/auth/twoFactor";
import { sealSecret } from "@/lib/auth/secretBox";
import { generateTotpSecret, timeStep, totpAt } from "@/lib/auth/totp";
import { hashRecoveryCode } from "@/lib/auth/recoveryCodes";
import { resetFailureThrottles } from "@/lib/rateLimit";

const EMAIL = "admin@test.com";
const PASSWORD = "correct horse battery";
let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env["NEXTAUTH_SECRET"] = "test-secret-for-authorize-0123456789";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await User.create({ email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 4) });
});

afterEach(async () => {
  await User.deleteMany({});
  resetFailureThrottles();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function enableTwoFactor(recoveryCode?: string): Promise<string> {
  const secret = generateTotpSecret();
  await User.updateOne(
    { email: EMAIL },
    {
      $set: {
        twoFactorEnabled: true,
        totpSecretEnc: sealSecret(secret),
        recoveryCodeHashes: recoveryCode ? [hashRecoveryCode(recoveryCode)] : [],
      },
    },
  );
  return secret;
}

describe("authorizeCredentials without 2FA", () => {
  it("signs in with the right password", async () => {
    const user = await authorizeCredentials({ email: EMAIL, password: PASSWORD }, "1.1.1.1");
    expect(user?.email).toBe(EMAIL);
  });

  it("ignores email case and whitespace", async () => {
    const user = await authorizeCredentials({ email: "  Admin@Test.com ", password: PASSWORD }, "1.1.1.1");
    expect(user?.email).toBe(EMAIL);
  });

  it("rejects a wrong password or unknown email", async () => {
    expect(await authorizeCredentials({ email: EMAIL, password: "nope" }, "1.1.1.1")).toBeNull();
    expect(await authorizeCredentials({ email: "x@test.com", password: PASSWORD }, "1.1.1.1")).toBeNull();
  });

  it("rejects non-string credentials", async () => {
    expect(await authorizeCredentials({ email: { $ne: "" }, password: PASSWORD }, "1.1.1.1")).toBeNull();
  });

  it("throttles an IP after too many failures, even with the right password", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await authorizeCredentials({ email: EMAIL, password: "nope" }, "2.2.2.2");
    }
    await expect(authorizeCredentials({ email: EMAIL, password: PASSWORD }, "2.2.2.2")).rejects.toBeInstanceOf(
      LoginThrottledError,
    );
    // Other IPs are unaffected
    expect(await authorizeCredentials({ email: EMAIL, password: PASSWORD }, "3.3.3.3")).not.toBeNull();
  });

  it("resets the failure count after a successful sign-in", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) {
      await authorizeCredentials({ email: EMAIL, password: "nope" }, "4.4.4.4");
    }
    await authorizeCredentials({ email: EMAIL, password: PASSWORD }, "4.4.4.4");
    await authorizeCredentials({ email: EMAIL, password: "nope" }, "4.4.4.4");
    expect(await authorizeCredentials({ email: EMAIL, password: PASSWORD }, "4.4.4.4")).not.toBeNull();
  });
});

describe("authorizeCredentials with 2FA", () => {
  it("asks for a code after the right password", async () => {
    await enableTwoFactor();
    await expect(authorizeCredentials({ email: EMAIL, password: PASSWORD }, "1.1.1.1")).rejects.toBeInstanceOf(
      TwoFactorRequiredError,
    );
  });

  it("doesn't reveal 2FA status for a wrong password", async () => {
    await enableTwoFactor();
    expect(await authorizeCredentials({ email: EMAIL, password: "nope" }, "1.1.1.1")).toBeNull();
  });

  it("signs in with a valid code", async () => {
    const secret = await enableTwoFactor();
    const user = await authorizeCredentials(
      { email: EMAIL, password: PASSWORD, otp: totpAt(secret, timeStep()) },
      "1.1.1.1",
    );
    expect(user?.email).toBe(EMAIL);
  });

  it("rejects a reused code", async () => {
    const secret = await enableTwoFactor();
    const otp = totpAt(secret, timeStep());
    await authorizeCredentials({ email: EMAIL, password: PASSWORD, otp }, "1.1.1.1");
    await expect(
      authorizeCredentials({ email: EMAIL, password: PASSWORD, otp }, "1.1.1.1"),
    ).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
  });

  it("rejects a wrong code", async () => {
    const secret = await enableTwoFactor();
    const wrong = totpAt(secret, timeStep() + 5);
    await expect(
      authorizeCredentials({ email: EMAIL, password: PASSWORD, otp: wrong }, "1.1.1.1"),
    ).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
  });

  it("accepts a recovery code once", async () => {
    await enableTwoFactor("ABCDE-FGHIJ");
    const creds = { email: EMAIL, password: PASSWORD, otp: "abcde-fghij" };
    expect(await authorizeCredentials(creds, "1.1.1.1")).not.toBeNull();
    await expect(authorizeCredentials(creds, "1.1.1.1")).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
  });

  it("pauses code checks for the account after repeated bad codes, across IPs", async () => {
    const secret = await enableTwoFactor();
    for (let i = 0; i < TWO_FACTOR_MAX_FAILURES; i++) {
      await authorizeCredentials(
        { email: EMAIL, password: PASSWORD, otp: totpAt(secret, timeStep() + 5) },
        `10.0.0.${i}`,
      ).catch(() => undefined);
    }
    await expect(
      authorizeCredentials({ email: EMAIL, password: PASSWORD, otp: totpAt(secret, timeStep()) }, "10.0.1.1"),
    ).rejects.toBeInstanceOf(LoginThrottledError);
  });
});

describe("clientIp", () => {
  it("prefers X-Real-IP from nginx", () => {
    const req = new Request("http://x", { headers: { "x-real-ip": "5.5.5.5", "x-forwarded-for": "6.6.6.6" } });
    expect(clientIp(req)).toBe("5.5.5.5");
  });

  it("falls back to the first X-Forwarded-For hop, then 'unknown'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "7.7.7.7, 8.8.8.8" } }))).toBe("7.7.7.7");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
