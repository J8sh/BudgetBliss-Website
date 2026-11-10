import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { buildExport } from "@/lib/csv/exporter";

const ExportQuerySchema = z
  .object({
    type: z.enum(["receipts", "line-items", "income", "recurring"]),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "from must be on or before to", path: ["from"] });

/** GET /api/export?type=receipts|line-items|income|recurring[&from=YYYY-MM-DD][&to=YYYY-MM-DD] → CSV download */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const query = ExportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    await connectDB();

    const { filename, csv, rowCount } = await buildExport(query.type, { from: query.from, to: query.to });
    logger.info({ type: query.type, rowCount }, "CSV export");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid export options", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    logger.error({ error: err }, "GET /api/export failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
