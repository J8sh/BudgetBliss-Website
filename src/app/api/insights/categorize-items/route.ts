import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import { Receipt } from "@/lib/models/Receipt";
import { checkRateLimit } from "@/lib/rateLimit";
import { guessMerchant } from "@/lib/finance/categories";
import { loadRules } from "@/lib/finance/loadInsights";
import { categorizeItems, CategorizeError, MAX_ITEMS_PER_CALL, type ItemToCategorize } from "@/lib/api/categorizeItems";

/**
 * Line items that would change the numbers if categorized: items without a category on
 * receipts from stores that sell across categories (or unrecognized stores), where you
 * haven't already set a category for the whole store.
 */
async function findUncategorizedItems(): Promise<ItemToCategorize[]> {
  const [receipts, rules] = await Promise.all([
    Receipt.find({ lineItems: { $elemMatch: { $or: [{ category: { $exists: false } }, { category: null }, { category: "" }] } } })
      .select("_id storeName lineItems.name lineItems.description lineItems.category receiptDate")
      .sort({ receiptDate: -1 })
      .lean(),
    loadRules(),
  ]);

  const items: ItemToCategorize[] = [];
  for (const r of receipts) {
    const merchant = guessMerchant(r.storeName);
    if (rules.has(merchant.key) || (!merchant.mixed && merchant.category)) continue;
    r.lineItems.forEach((item, index) => {
      if (!item.category) {
        items.push({ ref: `${r._id.toString()}:${index}`, name: item.name, description: item.description, store: r.storeName });
      }
    });
  }
  return items;
}

/** GET: how many items are waiting to be sorted */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    await connectDB();
    const items = await findUncategorizedItems();
    return NextResponse.json({ remaining: items.length, batchSize: MAX_ITEMS_PER_CALL });
  } catch (err) {
    logger.error({ error: err }, "GET /api/insights/categorize-items failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/** POST: sorts the next batch of items with Claude. Call repeatedly until remaining is 0. Takes no body. */
export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // Each batch is one paid Claude call
  const rl = checkRateLimit({ key: "categorize-items", maxRequests: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "That's a lot of sorting for one hour. Try again later.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    await connectDB();
    const pending = await findUncategorizedItems();
    const batch = pending.slice(0, MAX_ITEMS_PER_CALL);
    if (batch.length === 0) return NextResponse.json({ categorized: 0, remaining: 0 });

    const categories = await categorizeItems(batch);

    const updates = new Map<string, Record<string, string>>();
    for (const [ref, category] of categories) {
      const [receiptId, index] = ref.split(":");
      const set = updates.get(receiptId!) ?? {};
      set[`lineItems.${index}.category`] = category;
      updates.set(receiptId!, set);
    }
    if (updates.size > 0) {
      await Receipt.bulkWrite(
        [...updates].map(([id, set]) => ({
          updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { $set: set } },
        })),
        { ordered: false },
      );
    }

    logger.info({ categorized: categories.size, attempted: batch.length }, "Line items categorized");
    return NextResponse.json({ categorized: categories.size, remaining: pending.length - categories.size });
  } catch (err) {
    if (err instanceof CategorizeError) {
      return NextResponse.json({ error: "Couldn't sort items right now. Try again in a minute.", code: "AI_UNAVAILABLE" }, { status: 503 });
    }
    logger.error({ error: err }, "POST /api/insights/categorize-items failed");
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
