import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";
import {
  TWO_FACTOR_MAX_FAILURES,
  TWO_FACTOR_WINDOW_MS,
  verifySecondFactor,
} from "@/lib/auth/twoFactor";
import { checkFailureThrottle, clearFailures, recordFailure } from "@/lib/rateLimit";

const DisableSchema = z.object({
  password: z.string().min(1).max(1024),
  code: z.string().trim().min(6).max(32),
});

/** Turns 2FA off. Needs the password and a current code (or a recovery code). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const { password, code } = DisableSchema.parse(await req.json());

    const user = await User.findOne({ email: session.user?.email })
      .select("twoFactorEnabled +passwordHash")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }
    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor login is already off.", code: "NOT_ENABLED" },
        { status: 409 },
      );
    }

    const throttleKey = `2fa-disable:${user._id.toString()}`;
    if (checkFailureThrottle(throttleKey, TWO_FACTOR_MAX_FAILURES).blocked) {
      return NextResponse.json(
        { error: "Too many failed attempts. Wait a few minutes and try again.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    const codeOk = passwordOk && (await verifySecondFactor(user._id, code));
    if (!codeOk) {
      recordFailure(throttleKey, TWO_FACTOR_WINDOW_MS);
      return NextResponse.json(
        { error: "Password or code is incorrect.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    clearFailures(throttleKey);

    await User.updateOne(
      { _id: user._id },
      {
        $set: { twoFactorEnabled: false, recoveryCodeHashes: [] },
        $unset: { totpSecretEnc: "", totpLastStep: "", totpPendingSecretEnc: "", totpPendingCreatedAt: "" },
      },
    );

    logger.info({ email: session.user?.email }, "Two-factor login turned off");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "POST /api/user/two-factor/disable failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
