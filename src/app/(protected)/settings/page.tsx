import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Settings — BudgetBliss",
};

export default async function SettingsPage() {
  const session = await auth();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{session?.user?.email}</p>
      </div>
      <SettingsClient />
    </div>
  );
}
