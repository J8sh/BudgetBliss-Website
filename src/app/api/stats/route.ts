import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { RecurringCost } from "@/lib/models/RecurringCost";
import { logger } from "@/lib/logger";
import { loadRules } from "@/lib/finance/loadInsights";
import { toMonthly } from "@/lib/finance/insights";
import { classifyReceipts } from "@/lib/finance/spending";
import { buildStats, DEFAULT_RANGE, statsWindowStart } from "@/lib/finance/stats";
import { viewerNow } from "@/lib/utils/dates";
import type { StatRange } from "@/types/stats";

const QuerySchema = z.object({
  range: z.enum(["30d", "60d", "3m", "6m", "1y"]).default(DEFAULT_RANGE),
  /** The viewer's local calendar date, so "today" matches theirs rather than the server's UTC date */
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
});

/** GET /api/stats?range=30d|60d|3m|6m|1y&today=YYYY-MM-DD: dashboard totals, spending chart and top stores */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { range, today } = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    await connectDB();

    const now = viewerNow(today);
    const [receipts, rules, recurring] = await Promise.all([
      Receipt.find({ receiptDate: { $gte: statsWindowStart(now, range as StatRange) } })
        .select("_id storeName receiptDate grandTotal tags lineItems.name lineItems.totalPrice lineItems.category")
        .sort({ receiptDate: 1 })
        .lean(),
      loadRules(),
      RecurringCost.find({ isActive: true }).select("amount frequency").lean(),
    ]);

    const classified = classifyReceipts(
      receipts.map((r) => ({
        id: r._id.toString(),
        storeName: r.storeName,
        receiptDate: r.receiptDate,
        grandTotal: r.grandTotal,
        tags: r.tags ?? [],
        lineItems: (r.lineItems ?? []).map((i) => ({ name: i.name, totalPrice: i.totalPrice, category: i.category })),
      })),
      rules,
      recurring.map((c) => toMonthly(c.amount, c.frequency)),
    );

    return NextResponse.json(buildStats(classified, now, range as StatRange), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid range", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "GET /api/stats failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
