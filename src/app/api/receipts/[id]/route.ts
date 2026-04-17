import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { logger } from "@/lib/logger";
import { UpdateReceiptSchema } from "@/lib/utils/validators";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type RouteParams = { params: Promise<{ id: string }> };

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─── GET /api/receipts/[id] ───────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid receipt ID", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    await connectDB();

    const receipt = await Receipt.findById(id).lean();
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ receipt: { ...receipt, _id: receipt._id.toString() } });
  } catch (err) {
    logger.error({ error: err, receiptId: id }, "GET /api/receipts/[id] failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ─── PUT /api/receipts/[id] ───────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid receipt ID", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    await connectDB();

    const body = UpdateReceiptSchema.parse(await req.json());

    const updateData: Record<string, unknown> = { ...body };
    if (body.receiptDate) {
      updateData["receiptDate"] = new Date(body.receiptDate);
    }

    const updated = await Receipt.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).lean();

    if (!updated) {
      return NextResponse.json({ error: "Receipt not found", code: "NOT_FOUND" }, { status: 404 });
    }

    logger.info({ receiptId: id }, "Receipt updated");
    return NextResponse.json({ receipt: { ...updated, _id: updated._id.toString() } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err, receiptId: id }, "PUT /api/receipts/[id] failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ─── DELETE /api/receipts/[id] ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid receipt ID", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    await connectDB();

    const receipt = await Receipt.findByIdAndDelete(id).lean();
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Delete associated image file if it exists
    if (receipt.imagePath) {
      const filePath = path.join(UPLOADS_DIR, receipt.imagePath);
      await fs.unlink(filePath).catch((err) => {
        // Log but don't fail — file may have been manually deleted
        logger.warn({ error: err, imagePath: receipt.imagePath }, "Could not delete receipt image file");
      });
    }

    logger.info({ receiptId: id }, "Receipt deleted");
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ error: err, receiptId: id }, "DELETE /api/receipts/[id] failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
