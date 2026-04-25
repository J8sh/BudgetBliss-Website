export type IncomeFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type IncomeCategory = "employment" | "freelance" | "investments" | "passive" | "other";

export interface Income {
  _id: string;
  name: string;
  amount: number; // cents
  frequency: IncomeFrequency;
  category?: IncomeCategory;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSummary {
  monthlyTotal: number; // cents, normalized
  yearlyTotal: number; // cents, normalized
  activeCount: number;
}

export interface IncomeResponse {
  items: Income[];
  summary: IncomeSummary;
}
