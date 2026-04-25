import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { Income } from "@/lib/models/Income";
import { UpdateIncomeSchema } from "@/lib/utils/validators";

type RouteContext = { params: Promise<{ id: string }> };

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID", code: "INVALID_ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const body = UpdateIncomeSchema.parse(await req.json());
    const item = await Income.findByIdAndUpdate(id, body, { returnDocument: "after", runValidators: true });
    if (!item) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ context: `PUT /api/income/${id}`, error: err }, "Failed to update income");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID", code: "INVALID_ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const item = await Income.findByIdAndDelete(id);
    if (!item) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ context: `DELETE /api/income/${id}`, error: err }, "Failed to delete income");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
