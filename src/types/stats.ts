export interface SpendSummary {
  /** Amount in cents */
  today: number;
  week: number;
  month: number;
  year: number;
}

export interface DailySpend {
  date: string; // YYYY-MM-DD
  /** Amount in cents */
  total: number;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  /** Amount in cents */
  total: number;
  count: number;
}

export interface TopStore {
  storeName: string;
  /** Amount in cents */
  total: number;
  count: number;
}

export type StatRange = "30d" | "60d" | "3m" | "6m" | "1y";
export type SpendBucket = "day" | "week" | "month";

export interface SpendPoint {
  /** First day of the bucket, YYYY-MM-DD */
  start: string;
  /** Short axis label ("Nov 3", "Nov") */
  label: string;
  /** Full label for the tooltip ("Week of Nov 3, 2026") */
  fullLabel: string;
  /** Amount in cents */
  total: number;
  count: number;
  /** The current week or month, still in progress */
  partial: boolean;
}

export interface SpendSeries {
  bucket: SpendBucket;
  points: SpendPoint[];
  /** Average per complete bucket, in cents (null with no complete buckets) */
  average: number | null;
  /** Total for the whole range, in cents */
  total: number;
}

export interface StatsResponse {
  /** Day-to-day spending only: transfers and recurring bills are left out */
  summary: SpendSummary;
  range: StatRange;
  series: SpendSeries;
  dailySpend: DailySpend[]; // last 30 days
  categoryBreakdown: CategoryBreakdown[];
  /** Top stores within the selected range */
  topStores: TopStore[];
}
