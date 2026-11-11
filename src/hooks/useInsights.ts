"use client";

import { useCallback, useEffect, useState } from "react";
import type { InsightsReport, MerchantSummary } from "@/types/insights";
import { localDateString } from "@/lib/utils/dates";

interface UseInsightsResult {
  report: InsightsReport | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** The spending review for a month ("YYYY-MM"), or the current month when omitted */
export function useInsights(month?: string): UseInsightsResult {
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/insights?today=${localDateString()}${month ? `&month=${month}` : ""}`);
        if (!res.ok) throw new Error(`Insights fetch failed: ${res.status}`);
        const data = (await res.json()) as InsightsReport;
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load insights");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { report, isLoading, error, refetch };
}

interface UseMerchantsResult {
  merchants: MerchantSummary[];
  isLoading: boolean;
  refetch: () => void;
}

export function useMerchants(enabled: boolean): UseMerchantsResult {
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/insights/merchants");
        if (res.ok && !cancelled) setMerchants(((await res.json()) as { merchants: MerchantSummary[] }).merchants);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { merchants, isLoading, refetch };
}
