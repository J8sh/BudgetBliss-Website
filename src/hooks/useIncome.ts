"use client";

import { useState, useEffect } from "react";
import type { Income, IncomeSummary } from "@/types/income";

interface UseIncomeResult {
  items: Income[];
  summary: IncomeSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useIncome(): UseIncomeResult {
  const [items, setItems] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchIncome() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/income");
        if (!res.ok) throw new Error(`Income fetch failed: ${res.status}`);
        const json = (await res.json()) as { items: Income[]; summary: IncomeSummary };
        if (!cancelled) {
          setItems(json.items);
          setSummary(json.summary);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load income");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchIncome();
    return () => { cancelled = true; };
  }, [tick]);

  return { items, summary, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
