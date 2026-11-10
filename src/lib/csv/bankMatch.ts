import { Receipt } from "@/lib/models/Receipt";

/**
 * Bank statements and receipts describe the same purchase differently ("SQ *BLUE BOTTLE 0423"
 * vs "Blue Bottle Coffee"), and the bank's date can lag by a day or two. So a statement row and
 * a receipt are treated as the same purchase when the amount matches exactly within this window.
 */
export const BANK_MATCH_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The receipt imported from a bank statement (and not yet given a photo) that a newly
 * photographed receipt most likely is: same total, closest date within the window.
 */
export async function findImportedPurchase(grandTotal: number, receiptDate: Date) {
  const windowMs = BANK_MATCH_WINDOW_DAYS * DAY_MS;
  const candidates = await Receipt.find({
    tags: "bank-import",
    imagePath: { $exists: false },
    grandTotal,
    receiptDate: {
      $gte: new Date(receiptDate.getTime() - windowMs),
      $lte: new Date(receiptDate.getTime() + windowMs),
    },
  })
    .select("_id receiptDate")
    .lean();

  let best: (typeof candidates)[number] | undefined;
  for (const c of candidates) {
    const distance = Math.abs(c.receiptDate.getTime() - receiptDate.getTime());
    if (!best || distance < Math.abs(best.receiptDate.getTime() - receiptDate.getTime())) best = c;
  }
  return best;
}
