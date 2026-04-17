import { NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { logger } from "@/lib/logger";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  toISODateString,
} from "@/lib/utils/dates";
import type { StatsResponse } from "@/types/stats";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();

    const now = new Date();

    // ─── Summary (day / week / month / year) ────────────────────────────────────
    const summaryPipeline = [
      {
        $facet: {
          today: [
            { $match: { receiptDate: { $gte: startOfDay(now), $lte: endOfDay(now) } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
          week: [
            { $match: { receiptDate: { $gte: startOfWeek(now), $lte: endOfWeek(now) } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
          month: [
            { $match: { receiptDate: { $gte: startOfMonth(now), $lte: endOfMonth(now) } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
          year: [
            { $match: { receiptDate: { $gte: startOfYear(now), $lte: endOfYear(now) } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
        },
      },
    ];

    // ─── Daily spend (last 30 days) ───────────────────────────────────────────────
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyPipeline = [
      { $match: { receiptDate: { $gte: thirtyDaysAgo, $lte: endOfDay(now) } } },
      {
        $group: {
          _id: {
            year: { $year: "$receiptDate" },
            month: { $month: "$receiptDate" },
            day: { $dayOfMonth: "$receiptDate" },
          },
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ];

    // ─── Top stores (current month) ───────────────────────────────────────────────
    const topStoresPipeline = [
      { $match: { receiptDate: { $gte: startOfMonth(now), $lte: endOfMonth(now) } } },
      { $group: { _id: "$storeName", total: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ];

    const [summaryResult, dailyResult, topStoresResult] = await Promise.all([
      Receipt.aggregate(summaryPipeline as PipelineStage[]),
      Receipt.aggregate(dailyPipeline as PipelineStage[]),
      Receipt.aggregate(topStoresPipeline as PipelineStage[]),
    ]);

    const summary = summaryResult[0] as {
      today: Array<{ total: number }>;
      week: Array<{ total: number }>;
      month: Array<{ total: number }>;
      year: Array<{ total: number }>;
    } | undefined;

    // Build 30-day array with zeros for missing days
    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const entry of dailyResult as Array<{
      _id: { year: number; month: number; day: number };
      total: number;
      count: number;
    }>) {
      const date = new Date(entry._id.year, entry._id.month - 1, entry._id.day);
      dailyMap.set(toISODateString(date), { total: entry.total, count: entry.count });
    }

    const dailySpend = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(thirtyDaysAgo);
      d.setDate(thirtyDaysAgo.getDate() + i);
      const dateStr = toISODateString(d);
      const entry = dailyMap.get(dateStr);
      return { date: dateStr, total: entry?.total ?? 0, count: entry?.count ?? 0 };
    });

    const response: StatsResponse = {
      summary: {
        today: summary?.today[0]?.total ?? 0,
        week: summary?.week[0]?.total ?? 0,
        month: summary?.month[0]?.total ?? 0,
        year: summary?.year[0]?.total ?? 0,
      },
      dailySpend,
      categoryBreakdown: [], // future: line item categories
      topStores: (topStoresResult as Array<{ _id: string; total: number; count: number }>).map(
        (s) => ({ storeName: s._id, total: s.total, count: s.count }),
      ),
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error({ error: err }, "GET /api/stats failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
