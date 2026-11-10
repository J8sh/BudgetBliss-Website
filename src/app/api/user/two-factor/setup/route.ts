import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";
import { sealSecret } from "@/lib/auth/secretBox";
import { buildOtpauthUrl, generateTotpSecret } from "@/lib/auth/totp";
import { TWO_FACTOR_ISSUER } from "@/lib/auth/twoFactor";
import type { TwoFactorSetup } from "@/types/twoFactor";

/** Starts 2FA setup: creates a pending secret and returns it as a QR code. Takes no body. */
export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findOne({ email: session.user?.email }).select("email twoFactorEnabled").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor login is already on.", code: "ALREADY_ENABLED" },
        { status: 409 },
      );
    }

    const secret = generateTotpSecret();
    await User.updateOne(
      { _id: user._id },
      { $set: { totpPendingSecretEnc: sealSecret(secret), totpPendingCreatedAt: new Date() } },
    );

    const otpauthUrl = buildOtpauthUrl({ secret, account: user.email, issuer: TWO_FACTOR_ISSUER });
    const qrSvg = await QRCode.toString(otpauthUrl, {
      type: "svg",
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const body: TwoFactorSetup = { secret, otpauthUrl, qrSvg };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error({ error: err }, "POST /api/user/two-factor/setup failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
