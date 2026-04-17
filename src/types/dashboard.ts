export type BlockId =
  | "today-spend"
  | "week-spend"
  | "month-spend"
  | "year-spend"
  | "spend-line-chart"
  | "category-pie-chart"
  | "recent-receipts"
  | "top-stores";

export interface DashboardBlockLayout {
  i: BlockId;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
}

export type Theme = "light" | "dark" | "system";
