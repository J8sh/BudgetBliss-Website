import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In — BudgetBliss",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">BudgetBliss</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        {/* Suspense required because LoginForm uses useSearchParams() */}
        <Suspense fallback={<div className="h-48 rounded-lg bg-muted animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
