import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";
import type { TwoFactorStatus } from "@/types/twoFactor";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findOne({ email: session.user?.email })
      .select("twoFactorEnabled +recoveryCodeHashes")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const status: TwoFactorStatus = {
      enabled: user.twoFactorEnabled ?? false,
      recoveryCodesRemaining: user.recoveryCodeHashes?.length ?? 0,
    };
    return NextResponse.json(status);
  } catch (err) {
    logger.error({ error: err }, "GET /api/user/two-factor failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
