import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { hashBuffer } from "@/lib/image/hash";
import {
  optimizeForStorage,
  optimizeForClaude,
  validateImageMagicBytes,
  ACCEPTED_MIME_TYPES,
} from "@/lib/image/optimize";
import { extractReceiptData, NotAReceiptError, ClaudeApiError } from "@/lib/api/claude";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";
import { startOfDay, endOfDay } from "@/lib/utils/dates";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Ensure the uploads directory exists */
async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // Rate limit: 20 uploads per 10 minutes to protect Claude API costs
  const rl = checkRateLimit({ key: "upload", maxRequests: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait before trying again.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Step 1 — Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: expected multipart/form-data", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing required field: image", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20 MB.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  // Validate MIME type
  const mimeType = file.type.toLowerCase() as (typeof ACCEPTED_MIME_TYPES)[number];
  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      {
        error: `Invalid file type: ${file.type}. Accepted: JPEG, PNG, WebP, HEIC`,
        code: "INVALID_FILE_TYPE",
      },
      { status: 415 },
    );
  }

  // Read file into buffer
  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // Validate magic bytes (prevent MIME spoofing)
  if (!validateImageMagicBytes(rawBuffer)) {
    return NextResponse.json(
      { error: "File content does not match a valid image format.", code: "INVALID_FILE_TYPE" },
      { status: 415 },
    );
  }

  // Step 2 — Hash the original raw buffer
  const imageHash = hashBuffer(rawBuffer);

  try {
    await connectDB();
  } catch {
    return NextResponse.json(
      { error: "Database connection failed", code: "INTERNAL_ERROR" },
      { status: 503 },
    );
  }

  // Step 2 cont — Check for exact duplicate
  const existingByHash = await Receipt.findOne({ imageHash }).select("_id storeName receiptDate").lean();
  if (existingByHash) {
    return NextResponse.json(
      {
        error: "This receipt image has already been uploaded.",
        code: "DUPLICATE_RECEIPT",
        existingReceiptId: existingByHash._id.toString(),
      },
      { status: 409 },
    );
  }

  // Step 3 — Optimize for storage
  let storageBuffer: Buffer;
  try {
    const result = await optimizeForStorage(rawBuffer);
    storageBuffer = result.buffer;
  } catch (err) {
    logger.error({ error: err }, "Image optimization failed");
    return NextResponse.json(
      { error: "Failed to process the image.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  // Step 4 — Save optimized image to disk
  await ensureUploadsDir();
  const filename = `${Date.now()}-${imageHash.slice(0, 8)}.webp`;
  const imagePath = path.join(UPLOADS_DIR, filename);
  const imageUrl = `/uploads/${filename}`;

  try {
    await fs.writeFile(imagePath, storageBuffer);
    logger.info({ filename, sizeBytes: storageBuffer.length }, "Receipt image saved");
  } catch (err) {
    logger.error({ error: err, filename }, "Failed to save image to disk");
    return NextResponse.json(
      { error: "Failed to save the image.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  // From here: image is on disk. If later steps fail, we keep the image for manual entry.
  const partialResponse = {
    imageUrl,
    imagePath: filename,
    imageHash,
    message: "Image saved. Manual entry required.",
  };

  // Step 5 — Call Claude API
  const rawResponseHolder = { value: "" };
  let extractedData;
  let extractionMethod: "claude" | "failed" | "claude-partial" = "failed";

  try {
    const claudeBuffer = await optimizeForClaude(storageBuffer);
    extractedData = await extractReceiptData(claudeBuffer, rawResponseHolder);
    extractionMethod = "claude";
  } catch (err) {
    if (err instanceof NotAReceiptError) {
      // Clean up the saved image since it's not a receipt
      await fs.unlink(imagePath).catch(() => {
        // Ignore cleanup errors
      });
      return NextResponse.json(
        { error: err.message, code: "NOT_A_RECEIPT" },
        { status: 422 },
      );
    }

    if (err instanceof ClaudeApiError) {
      logger.error({ error: err, imageHash: imageHash.slice(0, 8) }, "Claude API unavailable");
      // Continue to save receipt with extractionMethod='failed'
    } else {
      logger.error({ error: err, imageHash: imageHash.slice(0, 8) }, "Claude extraction failed");
    }
  }

  // Step 6 — Secondary dedup check (only if extraction succeeded)
  let isDuplicate = false;
  let duplicateOf: string | undefined;

  if (extractedData?.storeName && extractedData?.receiptDate && extractedData?.grandTotal != null) {
    const receiptDate = new Date(extractedData.receiptDate ?? "");
    if (!isNaN(receiptDate.getTime())) {
      const potentialDuplicate = await Receipt.findOne({
        storeName: { $regex: new RegExp(`^${extractedData.storeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        receiptDate: { $gte: startOfDay(receiptDate), $lte: endOfDay(receiptDate) },
        grandTotal: {
          $gte: (extractedData.grandTotal ?? 0) - 1,
          $lte: (extractedData.grandTotal ?? 0) + 1,
        },
      }).select("_id").lean();

      if (potentialDuplicate) {
        isDuplicate = true;
        duplicateOf = potentialDuplicate._id.toString();
        logger.warn(
          { existingId: duplicateOf, imageHash: imageHash.slice(0, 8) },
          "Possible duplicate receipt detected by metadata",
        );
      }
    }
  }

  // Step 7 — Save receipt document
  try {
    const receiptData = {
      imageHash,
      imagePath: filename,
      imageUrl,
      extractionMethod,
      extractionRaw: rawResponseHolder.value || undefined,
      storeName: extractedData?.storeName ?? "Unknown Store",
      storeAddress: extractedData?.storeAddress ?? undefined,
      receiptDate: extractedData?.receiptDate
        ? new Date(extractedData.receiptDate)
        : new Date(),
      paymentMethod: extractedData?.paymentMethod ?? undefined,
      cardLastFour: extractedData?.cardLastFour ?? undefined,
      lineItems: extractedData?.lineItems ?? [],
      subtotal: extractedData?.subtotal ?? undefined,
      taxAmount: extractedData?.taxAmount ?? undefined,
      grandTotal: extractedData?.grandTotal ?? 0,
      isDuplicate,
      duplicateOf: duplicateOf ? new (require("mongoose").Types.ObjectId)(duplicateOf) : undefined,
    };

    const receipt = await Receipt.create(receiptData);

    logger.info(
      { receiptId: receipt._id.toString(), extractionMethod, isDuplicate },
      "Receipt created successfully",
    );

    return NextResponse.json(
      {
        receipt: {
          _id: receipt._id.toString(),
          storeName: receipt.storeName,
          receiptDate: receipt.receiptDate,
          grandTotal: receipt.grandTotal,
          extractionMethod: receipt.extractionMethod,
          imageUrl: receipt.imageUrl,
          isDuplicate: receipt.isDuplicate,
          duplicateOf: receipt.duplicateOf?.toString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error({ error: err, imageHash: imageHash.slice(0, 8) }, "Failed to save receipt to DB");
    // Return partial response with image URL so admin can do manual entry
    return NextResponse.json(
      {
        error: "Failed to save receipt data. The image was saved — use manual entry to complete.",
        code: "INTERNAL_ERROR",
        ...partialResponse,
      },
      { status: 500 },
    );
  }
}
