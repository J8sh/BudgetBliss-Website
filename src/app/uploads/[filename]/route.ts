import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { logger } from "@/lib/logger";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type RouteParams = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { filename } = await params;

  // Prevent path traversal attacks
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeName);

  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    logger.error({ error: err, filePath }, "Failed to serve upload");
    return NextResponse.json({ error: "Image not found", code: "NOT_FOUND" }, { status: 404 });
  }
}
