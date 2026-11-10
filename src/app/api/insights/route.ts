import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { currentMonth, loadInsightsReport } from "@/lib/finance/loadInsights";

const QuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
    .optional(),
});

/** GET /api/insights?month=YYYY-MM: the spending review for one month (default: this month) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { month } = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    await connectDB();
    const report = await loadInsightsReport(month ?? currentMonth());
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid month", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "GET /api/insights failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
