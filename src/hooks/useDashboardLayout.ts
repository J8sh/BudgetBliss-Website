"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardBlockLayout } from "@/types/dashboard";

/** Default block layout — used when user has no saved layout yet */
export const DEFAULT_LAYOUT: DashboardBlockLayout[] = [
  { i: "today-spend", x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "week-spend", x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "month-spend", x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "year-spend", x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "spend-line-chart", x: 0, y: 3, w: 8, h: 5, minW: 4, minH: 4 },
  { i: "category-pie-chart", x: 8, y: 3, w: 4, h: 5, minW: 3, minH: 4 },
  { i: "recent-receipts", x: 0, y: 8, w: 8, h: 4, minW: 4, minH: 3 },
  { i: "top-stores", x: 8, y: 8, w: 4, h: 4, minW: 3, minH: 3 },
  { i: "recurring-monthly", x: 0, y: 12, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "recurring-list", x: 3, y: 12, w: 9, h: 5, minW: 4, minH: 3 },
  { i: "income-monthly", x: 0, y: 17, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "net-monthly", x: 3, y: 17, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "income-list", x: 6, y: 17, w: 6, h: 5, minW: 4, minH: 3 },
];

interface UseDashboardLayoutResult {
  layout: DashboardBlockLayout[];
  isLoading: boolean;
  isSaving: boolean;
  updateLayout: (newLayout: DashboardBlockLayout[]) => void;
}

const DEBOUNCE_MS = 600;

export function useDashboardLayout(): UseDashboardLayoutResult {
  const [layout, setLayout] = useState<DashboardBlockLayout[]>(DEFAULT_LAYOUT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch saved layout on mount
  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch("/api/user/layout");
        if (res.ok) {
          const data = (await res.json()) as { layout: DashboardBlockLayout[] };
          if (data.layout.length > 0) {
            setLayout(data.layout);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    void fetchLayout();
  }, []);

  const updateLayout = useCallback((newLayout: DashboardBlockLayout[]) => {
    // Cast is safe because react-grid-layout Layout matches our type shape
    setLayout(newLayout);

    // Debounce the save to avoid too many API calls while dragging
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await fetch("/api/user/layout", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newLayout),
        });
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { layout, isLoading, isSaving, updateLayout };
}
