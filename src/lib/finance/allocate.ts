import {
  categoryFromText,
  guessMerchant,
  isExclusion,
  type CategoryKey,
  type ExclusionKind,
  type MerchantGuess,
  type StoreChoice,
} from "@/lib/finance/categories";
import type { CategorySource } from "@/types/insights";

/** What the insights need from a receipt */
export interface SpendReceipt {
  id: string;
  storeName: string;
  receiptDate: Date;
  grandTotal: number;
  tags: string[];
  lineItems: Array<{ name: string; totalPrice: number; category?: string }>;
}

export interface Allocation {
  merchant: MerchantGuess;
  source: CategorySource;
  /** The receipt total split across categories; parts add up to grandTotal exactly (empty when excluded) */
  parts: Array<{ category: CategoryKey; amount: number }>;
  /** Set when the receipt isn't spending (a transfer) or is already counted (a recurring bill) */
  excluded?: ExclusionKind;
}

/** Share of a mixed store's item value that must be categorized before items decide the split */
export const ITEM_COVERAGE_TO_SPLIT = 0.6;

/**
 * Splits `total` cents across weights so the parts add up exactly (largest remainder method).
 * Weights must be non-negative; returns an empty list if they're all zero.
 */
export function splitProportionally<K>(total: number, weights: Array<[K, number]>): Array<[K, number]> {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  if (sum <= 0) return [];
  const raw = weights.map(([k, w]) => [k, (total * w) / sum] as const);
  const floored = raw.map(([k, v]) => [k, Math.floor(v), v - Math.floor(v)] as const);
  let leftover = total - floored.reduce((s, [, v]) => s + v, 0);
  const order = [...floored.keys()].sort((a, b) => floored[b]![2] - floored[a]![2]);
  const result = floored.map(([k, v]) => [k, v] as [K, number]);
  for (const i of order) {
    if (leftover <= 0) break;
    result[i]![1] += 1;
    leftover--;
  }
  return result.filter(([, v]) => v !== 0);
}

/**
 * Decides which categories a receipt's money went to:
 * 0. a store you marked "not spending" or "recurring bill", or a recognized transfer (card
 *    payment, savings), isn't spending at all;
 * 1. a category you set for the store always wins;
 * 2. a store that sells across categories is split by its line items, when enough are categorized;
 * 3. otherwise the store's suggested category, else the items', else "uncategorized".
 */
export function allocateReceipt(receipt: SpendReceipt, rules: ReadonlyMap<string, StoreChoice>): Allocation {
  const merchant = guessMerchant(receipt.storeName);
  const total = receipt.grandTotal;
  const whole = (category: CategoryKey, source: CategorySource): Allocation => ({
    merchant,
    source,
    parts: total > 0 ? [{ category, amount: total }] : [],
  });

  const yours = rules.get(merchant.key);
  if (isExclusion(yours)) return { merchant, source: "yours", parts: [], excluded: yours };
  if (yours) return whole(yours, "yours");
  if (merchant.excluded) return { merchant, source: "store", parts: [], excluded: merchant.excluded };

  const items = receipt.lineItems.map((item) => ({ amount: item.totalPrice, category: categoryFromText(item.category) }));
  const itemValue = items.reduce((s, i) => s + Math.abs(i.amount), 0);
  const categorizedValue = items.reduce((s, i) => s + (i.category ? Math.abs(i.amount) : 0), 0);
  const itemsUsable = itemValue > 0 && categorizedValue / itemValue >= ITEM_COVERAGE_TO_SPLIT;

  if (itemsUsable && (merchant.mixed || !merchant.category)) {
    const byCategory = new Map<CategoryKey, number>();
    for (const item of items) {
      const key: CategoryKey = item.category ?? merchant.category ?? "uncategorized";
      byCategory.set(key, (byCategory.get(key) ?? 0) + item.amount);
    }
    // Discounts can push a category below zero; they reduce what's left rather than going negative
    const weights = [...byCategory].map(([k, v]) => [k, Math.max(0, v)] as [CategoryKey, number]);
    const parts = splitProportionally(total, weights).map(([category, amount]) => ({ category, amount }));
    if (parts.length > 0) return { merchant, source: "items", parts };
  }

  if (merchant.category) return whole(merchant.category, "store");
  return whole("uncategorized", "none");
}
