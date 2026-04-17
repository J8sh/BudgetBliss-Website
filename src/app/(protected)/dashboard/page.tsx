import type { Metadata } from "next";
import { HomepageClient } from "@/components/dashboard/HomepageClient";

export const metadata: Metadata = {
  title: "Dashboard — BudgetBliss",
};

export default function DashboardPage() {
  return <HomepageClient />;
}
