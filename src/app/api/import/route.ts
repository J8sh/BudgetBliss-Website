import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { ImportError, MAX_IMPORT_BYTES, runImport } from "@/lib/csv/importer";

const BankMappingSchema = z.object({
  date: z.string().max(200),
  description: z.string().max(200),
  amount: z.string().max(200).optional(),
  debit: z.string().max(200).optional(),
  credit: z.string().max(200).optional(),
  spendingIs: z.enum(["negative", "positive"]),
  dateFormat: z.enum(["auto", "mdy", "dmy"]),
});

const ImportBodySchema = z.object({
  csv: z.string().min(1, "The file is empty").max(MAX_IMPORT_BYTES, "The file is larger than 5 MB"),
  kind: z.enum(["auto", "receipts", "line-items", "income", "recurring", "bank"]).default("auto"),
  mapping: BankMappingSchema.optional(),
  /** true = preview only; nothing is written */
  dryRun: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
});

/** POST /api/import: previews (dryRun) or applies a CSV import. Returns per-row results. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = ImportBodySchema.parse(await req.json());
    await connectDB();

    const result = await runImport(body);
    if (!body.dryRun) {
      logger.info({ kind: result.kind, counts: result.counts, written: result.written }, "CSV import applied");
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Validation failed", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message, code: "IMPORT_ERROR" }, { status: 400 });
    }
    logger.error({ error: err }, "POST /api/import failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
