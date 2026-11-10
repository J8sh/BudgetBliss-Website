import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";
import { openSecret, sealSecret } from "@/lib/auth/secretBox";
import { verifyTotp } from "@/lib/auth/totp";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth/recoveryCodes";
import {
  TOTP_SETUP_TTL_MS,
  TWO_FACTOR_MAX_FAILURES,
  TWO_FACTOR_WINDOW_MS,
} from "@/lib/auth/twoFactor";
import { checkFailureThrottle, clearFailures, recordFailure } from "@/lib/rateLimit";
import type { TwoFactorEnableResult } from "@/types/twoFactor";

const EnableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
});

/** Confirms setup with a code from the app, turns 2FA on, and returns one-time recovery codes */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const { code } = EnableSchema.parse(await req.json());

    const user = await User.findOne({ email: session.user?.email })
      .select("twoFactorEnabled +totpPendingSecretEnc +totpPendingCreatedAt")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor login is already on.", code: "ALREADY_ENABLED" },
        { status: 409 },
      );
    }

    const throttleKey = `2fa-enable:${user._id.toString()}`;
    if (checkFailureThrottle(throttleKey, TWO_FACTOR_MAX_FAILURES).blocked) {
      return NextResponse.json(
        { error: "Too many wrong codes. Wait a few minutes and try again.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const createdAt = user.totpPendingCreatedAt?.getTime() ?? 0;
    if (!user.totpPendingSecretEnc || Date.now() - createdAt > TOTP_SETUP_TTL_MS) {
      return NextResponse.json(
        { error: "Setup expired. Start setup again.", code: "SETUP_EXPIRED" },
        { status: 400 },
      );
    }

    const secret = openSecret(user.totpPendingSecretEnc);
    const step = verifyTotp(secret, code);
    if (step === null) {
      recordFailure(throttleKey, TWO_FACTOR_WINDOW_MS);
      return NextResponse.json(
        { error: "That code didn't match. Check the time on your phone and try again.", code: "INVALID_CODE" },
        { status: 400 },
      );
    }
    clearFailures(throttleKey);

    const recoveryCodes = generateRecoveryCodes();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          twoFactorEnabled: true,
          totpSecretEnc: sealSecret(secret),
          totpLastStep: step,
          recoveryCodeHashes: recoveryCodes.map((c) => hashRecoveryCode(c)!),
        },
        $unset: { totpPendingSecretEnc: "", totpPendingCreatedAt: "" },
      },
    );

    logger.info({ email: session.user?.email }, "Two-factor login turned on");
    const body: TwoFactorEnableResult = { recoveryCodes };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "POST /api/user/two-factor/enable failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
