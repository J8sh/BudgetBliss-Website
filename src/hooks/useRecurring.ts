"use client";

import { useState, useEffect } from "react";
import type { RecurringCost, RecurringSummary } from "@/types/recurringCost";

interface UseRecurringResult {
  items: RecurringCost[];
  summary: RecurringSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRecurring(): UseRecurringResult {
  const [items, setItems] = useState<RecurringCost[]>([]);
  const [summary, setSummary] = useState<RecurringSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecurring() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/recurring");
        if (!res.ok) throw new Error(`Recurring fetch failed: ${res.status}`);
        const json = (await res.json()) as { items: RecurringCost[]; summary: RecurringSummary };
        if (!cancelled) {
          setItems(json.items);
          setSummary(json.summary);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load recurring costs");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchRecurring();
    return () => { cancelled = true; };
  }, [tick]);

  return { items, summary, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
