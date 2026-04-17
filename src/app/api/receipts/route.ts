import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { logger } from "@/lib/logger";
import {
  CreateReceiptSchema,
  ReceiptListQuerySchema,
} from "@/lib/utils/validators";
import { startOfDay, endOfDay } from "@/lib/utils/dates";

// ─── GET /api/receipts ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = ReceiptListQuerySchema.parse(searchParams);

    // Build MongoDB filter
    const filter: Record<string, unknown> = {};

    if (query.search) {
      filter["storeName"] = { $regex: query.search, $options: "i" };
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter["$gte"] = startOfDay(new Date(query.dateFrom));
      if (query.dateTo) dateFilter["$lte"] = endOfDay(new Date(query.dateTo));
      filter["receiptDate"] = dateFilter;
    }

    if (query.paymentMethod) {
      filter["paymentMethod"] = query.paymentMethod;
    }

    if (query.isDuplicate !== undefined) {
      filter["isDuplicate"] = query.isDuplicate;
    }

    const sortField = query.sortBy;
    const sortDir = query.sortOrder === "asc" ? 1 : -1;
    const skip = (query.page - 1) * query.limit;

    const [receipts, total] = await Promise.all([
      Receipt.find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Receipt.countDocuments(filter),
    ]);

    return NextResponse.json({
      receipts: receipts.map((r) => ({ ...r, _id: r._id.toString() })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "GET /api/receipts failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ─── POST /api/receipts (manual entry) ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = CreateReceiptSchema.parse(await req.json());

    const receipt = await Receipt.create({
      ...body,
      receiptDate: new Date(body.receiptDate),
      extractionMethod: "manual",
    });

    logger.info({ receiptId: receipt._id.toString() }, "Manual receipt created");

    return NextResponse.json({ receipt: { ...receipt.toObject(), _id: receipt._id.toString() } }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "POST /api/receipts failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
