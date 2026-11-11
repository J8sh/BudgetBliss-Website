"use client";

import { useState, useEffect } from "react";
import type { StatRange, StatsResponse } from "@/types/stats";
import { localDateString } from "@/lib/utils/dates";

interface UseStatsResult {
  data: StatsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Dashboard stats; `range` sets the spending chart and top stores. Keeps the last data while a new range loads. */
export function useStats(range: StatRange = "30d"): UseStatsResult {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stats?range=${range}&today=${localDateString()}`);
        if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
        const json = (await res.json()) as StatsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchStats();
    return () => { cancelled = true; };
  }, [range, tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
