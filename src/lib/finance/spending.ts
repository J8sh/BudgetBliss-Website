import { allocateReceipt, type Allocation, type SpendReceipt } from "@/lib/finance/allocate";
import type { StoreChoice } from "@/lib/finance/categories";

/**
 * Which receipts are day-to-day spending. Shared by the Insights report and the dashboard so the
 * two always agree:
 * - transfers (card payments, savings) and stores marked "not spending" are left out;
 * - stores marked "recurring bill" are left out, since the recurring bills list counts them;
 * - a bank-imported charge for the same amount as a recurring bill is that bill, counted once
 *   per bill per month.
 */

export type SpendingKind = "spending" | "transfer" | "bill";

export interface ClassifiedReceipt {
  receipt: SpendReceipt;
  allocation: Allocation;
  kind: SpendingKind;
}

/** How close a bank charge must be to a recurring bill's monthly amount to be that bill */
function matchesBill(billCents: number, chargeCents: number): boolean {
  return Math.abs(billCents - chargeCents) <= Math.max(100, billCents * 0.01);
}

/**
 * Classifies receipts in the order given.
 * @param fixedMonthly monthly amounts (cents) of the active recurring bills
 */
export function classifyReceipts(
  receipts: SpendReceipt[],
  rules: ReadonlyMap<string, StoreChoice>,
  fixedMonthly: number[],
): ClassifiedReceipt[] {
  const unmatchedByMonth = new Map<string, number[]>();

  return receipts.map((receipt): ClassifiedReceipt => {
    const allocation = allocateReceipt(receipt, rules);
    if (allocation.excluded) return { receipt, allocation, kind: allocation.excluded };

    if (receipt.tags.includes("bank-import")) {
      const month = receipt.receiptDate.toISOString().slice(0, 7);
      let unmatched = unmatchedByMonth.get(month);
      if (!unmatched) {
        unmatched = fixedMonthly.filter((amount) => amount > 0);
        unmatchedByMonth.set(month, unmatched);
      }
      const i = unmatched.findIndex((amount) => matchesBill(amount, receipt.grandTotal));
      if (i >= 0) {
        unmatched.splice(i, 1);
        return { receipt, allocation, kind: "bill" };
      }
    }

    return { receipt, allocation, kind: "spending" };
  });
}
