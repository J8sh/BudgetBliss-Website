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

export interface StatsResponse {
  summary: SpendSummary;
  dailySpend: DailySpend[]; // last 30 days
  categoryBreakdown: CategoryBreakdown[];
  topStores: TopStore[];
}
