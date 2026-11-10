import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";
import { checkFailureThrottle, clearFailures, recordFailure } from "@/lib/rateLimit";
import {
  TWO_FACTOR_MAX_FAILURES,
  TWO_FACTOR_WINDOW_MS,
  verifySecondFactor,
} from "@/lib/auth/twoFactor";

/** Failed sign-ins allowed per IP before sign-in is paused for that IP */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// The `code` of each error reaches the login form, which uses it to pick what to show.
export class TwoFactorRequiredError extends CredentialsSignin {
  override code = "otp_required";
}
export class InvalidTwoFactorCodeError extends CredentialsSignin {
  override code = "invalid_otp";
}
export class LoginThrottledError extends CredentialsSignin {
  override code = "rate_limited";
}

// A real bcrypt hash (cost 12) so a login for an unknown email takes as long as a real one
const DUMMY_HASH = "$2b$12$erGViURIDaKBN9rm4gkigOmfh/JM7HvWK/jZdSinbKDmFIsDDwHm2";

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
  otp: z.string().trim().max(32).optional(),
});

/** The client IP as set by nginx (X-Real-IP), falling back to the first X-Forwarded-For hop */
export function clientIp(request: Request | undefined): string {
  const realIp = request?.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/**
 * Verifies email + password, then the second factor when the account has 2FA turned on.
 * Returns the user on success and null for a wrong email/password; throws a CredentialsSignin
 * subclass when the form needs to react differently (code needed, bad code, throttled).
 */
export async function authorizeCredentials(
  raw: Partial<Record<string, unknown>> | undefined,
  ip: string,
): Promise<{ id: string; email: string } | null> {
  const ipKey = `login-ip:${ip}`;

  if (checkFailureThrottle(ipKey, LOGIN_MAX_FAILURES).blocked) {
    logger.warn({ ip }, "Auth blocked: too many failed attempts from this IP");
    throw new LoginThrottledError();
  }

  const parsed = CredentialsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    logger.warn({ ip }, "Auth attempt with missing or malformed credentials");
    recordFailure(ipKey, LOGIN_WINDOW_MS);
    return null;
  }
  const { email, password, otp } = parsed.data;

  let user;
  try {
    await connectDB();
    user = await User.findOne({ email }).select("+passwordHash").lean();
  } catch (err) {
    logger.error({ error: err }, "Auth error during credential verification");
    return null;
  }

  const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !isValid) {
    logger.warn({ email, ip }, user ? "Auth failed: invalid password" : "Auth failed: user not found");
    recordFailure(ipKey, LOGIN_WINDOW_MS);
    return null;
  }

  if (user.twoFactorEnabled) {
    if (!otp) {
      throw new TwoFactorRequiredError();
    }

    const accountKey = `login-2fa:${user._id.toString()}`;
    if (checkFailureThrottle(accountKey, TWO_FACTOR_MAX_FAILURES).blocked) {
      logger.warn({ email, ip }, "Auth blocked: too many failed 2FA codes for this account");
      throw new LoginThrottledError();
    }

    let codeOk = false;
    try {
      codeOk = await verifySecondFactor(user._id, otp);
    } catch (err) {
      logger.error({ error: err }, "Auth error during 2FA verification");
    }

    if (!codeOk) {
      logger.warn({ email, ip }, "Auth failed: invalid 2FA code");
      recordFailure(ipKey, LOGIN_WINDOW_MS);
      recordFailure(accountKey, TWO_FACTOR_WINDOW_MS);
      throw new InvalidTwoFactorCodeError();
    }
    clearFailures(accountKey);
  }

  clearFailures(ipKey);
  logger.info({ email: user.email, ip }, "Admin logged in");
  return { id: user._id.toString(), email: user.email };
}
