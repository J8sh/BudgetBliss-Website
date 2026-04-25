import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { RecurringCost } from "@/lib/models/RecurringCost";
import { CreateRecurringSchema } from "@/lib/utils/validators";
import type { RecurringCostDoc } from "@/lib/models/RecurringCost";
import type { RecurringSummary } from "@/types/recurringCost";

const MONTHLY_FACTORS: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 4 / 12,
  yearly: 1 / 12,
};

function computeSummary(items: RecurringCostDoc[]): RecurringSummary {
  const active = items.filter((i) => i.isActive);
  const monthlyTotal = active.reduce(
    (sum, i) => sum + Math.round(i.amount * (MONTHLY_FACTORS[i.frequency] ?? 1)),
    0,
  );
  return {
    monthlyTotal,
    yearlyTotal: Math.round(monthlyTotal * 12),
    activeCount: active.length,
  };
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const items = await RecurringCost.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ items, summary: computeSummary(items as RecurringCostDoc[]) });
  } catch (err) {
    logger.error({ context: "GET /api/recurring", error: err }, "Failed to fetch recurring costs");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();
    const body = CreateRecurringSchema.parse(await req.json());
    const item = await RecurringCost.create(body);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ context: "POST /api/recurring", error: err }, "Failed to create recurring cost");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
