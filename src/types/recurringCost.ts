export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringCost {
  _id: string;
  name: string;
  amount: number; // cents
  frequency: RecurringFrequency;
  category?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSummary {
  monthlyTotal: number; // cents, normalized
  yearlyTotal: number; // cents, normalized
  activeCount: number;
}

export interface RecurringResponse {
  items: RecurringCost[];
  summary: RecurringSummary;
}
