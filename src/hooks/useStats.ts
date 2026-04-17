"use client";

import { useState, useEffect } from "react";
import type { StatsResponse } from "@/types/stats";

interface UseStatsResult {
  data: StatsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStats(): UseStatsResult {
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
        const res = await fetch("/api/stats");
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
  }, [tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
