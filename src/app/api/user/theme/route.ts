import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";

const ThemeSchema = z.object({ theme: z.enum(["light", "dark", "system"]) });

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const { theme } = ThemeSchema.parse(await req.json());
    await User.updateOne({ email: session.user?.email }, { $set: { theme } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid theme value", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "PUT /api/user/theme failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
