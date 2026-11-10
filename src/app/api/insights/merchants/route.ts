import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { MerchantRule } from "@/lib/models/MerchantRule";
import { STORE_CHOICES } from "@/lib/finance/categories";
import { loadMerchants } from "@/lib/finance/loadInsights";

/** GET /api/insights/merchants: every store with how its spending is categorized */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    return NextResponse.json({ merchants: await loadMerchants() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error({ error: err }, "GET /api/insights/merchants failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

const RuleSchema = z.object({
  key: z.string().trim().min(1).max(200),
  /** A category, "transfer" (not spending) or "bill" (already a recurring bill); null removes your choice */
  category: z.enum(STORE_CHOICES).nullable(),
});

/** PUT /api/insights/merchants: set (or clear) the category for every receipt from a store */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { key, category } = RuleSchema.parse(await req.json());
    await connectDB();
    if (category === null) {
      await MerchantRule.deleteOne({ key });
    } else {
      await MerchantRule.updateOne({ key }, { $set: { category } }, { upsert: true, runValidators: true });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "PUT /api/insights/merchants failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
