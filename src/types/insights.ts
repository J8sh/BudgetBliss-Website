import type { CategoryKey, CategoryKind, ExclusionKind, StoreChoice } from "@/lib/finance/categories";

/** All amounts are integer cents. Months are "YYYY-MM". */

export interface MerchantTotal {
  key: string;
  name: string;
  total: number;
  visits: number;
}

export interface PurchaseRef {
  receiptId: string;
  storeName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: CategoryKey;
}

export interface CategoryTotal {
  key: CategoryKey;
  label: string;
  kind: CategoryKind | null;
  total: number;
  /** Part of the total that comes from recurring costs */
  fixed: number;
  /** Part of the total from receipts */
  flexible: number;
  /** Share of all spending this month, 0–1 */
  share: number;
  previous: number;
  /** Average monthly total over the previous months with data (null if there are none) */
  average: number | null;
  topMerchants: MerchantTotal[];
  largest: PurchaseRef[];
  /** Monthly totals for this category, oldest first, matching InsightsReport.trend */
  history: number[];
}

export interface MoneyFlow {
  income: number;
  fixed: number;
  flexible: number;
  /** income − fixed − flexible (negative when spending exceeds income) */
  leftOver: number;
  /** leftOver / income, or null with no income on record */
  savingsRate: number | null;
  /** fixed / income, or null with no income on record */
  fixedShare: number | null;
}

export interface BudgetSplit {
  income: number;
  needs: number;
  wants: number;
  unsorted: number;
  savings: number;
  /** Shares of income, 0–1 (null with no income) */
  needsShare: number | null;
  wantsShare: number | null;
  savingsShare: number | null;
  unsortedShare: number | null;
}

export interface ChangeDriver {
  key: CategoryKey;
  label: string;
  delta: number;
  merchant?: { name: string; delta: number };
}

export interface MonthChange {
  previousLabel: string;
  previousFlexible: number;
  flexibleDelta: number;
  average: number | null;
  drivers: ChangeDriver[];
}

export interface Pace {
  /** Spending through today */
  spentSoFar: number;
  /** Spending last month through the same day of the month */
  sameDayLastMonth: number;
  lastMonthTotal: number;
  /** Straight-line projection for the whole month (null in the first week, when it's too noisy) */
  projected: number | null;
}

export interface Habits {
  topMerchants: Array<MerchantTotal & { average: number }>;
  smallPurchases: { threshold: number; count: number; total: number };
  biggest: PurchaseRef[];
}

export interface TrendPoint {
  month: string;
  label: string;
  flexible: number;
  fixed: number;
  total: number;
}

export type InsightAction =
  | { type: "category"; key: CategoryKey }
  | { type: "categorize" }
  | { type: "budget-rule" }
  | { type: "review" };

export interface Insight {
  id: string;
  tone: "neutral" | "good" | "watch";
  title: string;
  detail?: string;
  action?: InsightAction;
}

export interface Coverage {
  uncategorizedTotal: number;
  uncategorizedMerchants: number;
  /** Receipts this month whose photo couldn't be read */
  needsReview: number;
  /** Bank-imported charges counted as a recurring bill instead of day-to-day spending */
  matchedToFixed: number;
  /** Card payments, savings and other transfers, which aren't spending */
  transfers: { count: number; total: number };
}

export interface InsightsReport {
  month: string;
  label: string;
  isCurrentMonth: boolean;
  daysElapsed: number;
  daysInMonth: number;
  receiptCount: number;
  money: MoneyFlow;
  categories: CategoryTotal[];
  split: BudgetSplit;
  change: MonthChange;
  pace: Pace | null;
  habits: Habits;
  trend: TrendPoint[];
  coverage: Coverage;
  insights: Insight[];
  /** Months that have receipts, newest first, for the month picker */
  availableMonths: string[];
}

export type CategorySource = "yours" | "store" | "items" | "none";

export interface MerchantSummary {
  key: string;
  name: string;
  /** A spending category, or an exclusion (not spending / recurring bill) */
  category: CategoryKey | ExclusionKind;
  source: CategorySource;
  /** Suggested category (or "transfer") from the store name, shown when there's no rule of yours */
  suggested?: StoreChoice;
  mixed: boolean;
  visits: number;
  total: number;
  lastVisit: string;
}
