"use client";

import { useState } from "react";
import { Responsive as ResponsiveGridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { GripVertical, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatBlock } from "./StatBlock";
import { SpendChart } from "./SpendChart";
import { TopStoresChart } from "./CategoryPieChart";
import { RecentReceiptsBlock } from "./RecentReceiptsBlock";
import { TopStoresListBlock } from "./TopStoresListBlock";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useStats } from "@/hooks/useStats";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { DashboardBlockLayout, BlockId } from "@/types/dashboard";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export function DashboardGrid() {
  const { width: containerWidth, containerRef } = useContainerWidth();
  const { layout, isLoading: layoutLoading, isSaving, updateLayout } = useDashboardLayout();
  const { data: stats, isLoading: statsLoading } = useStats();
  const [isEditMode, setIsEditMode] = useState(false);

  function handleLayoutChange(newLayout: Layout) {
    if (!isEditMode) return;
    // Merge new positions back onto our typed layout (preserving minW/minH)
    const updated: DashboardBlockLayout[] = (newLayout as LayoutItem[]).map((item) => {
      const existing = layout.find((l) => l.i === item.i);
      return {
        i: item.i as BlockId,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: existing?.minW ?? 2,
        minH: existing?.minH ?? 2,
      };
    });
    updateLayout(updated);
  }

  const DRAG_HANDLE = "drag-handle";

  function renderBlock(id: BlockId) {
    const isLoading = statsLoading;
    const summary = stats?.summary;

    switch (id) {
      case "today-spend":
        return (
          <StatBlock
            title="Today"
            value={summary?.today ?? 0}
            isLoading={isLoading}
            dragHandleClassName={DRAG_HANDLE}
          />
        );
      case "week-spend":
        return (
          <StatBlock
            title="This Week"
            value={summary?.week ?? 0}
            isLoading={isLoading}
            dragHandleClassName={DRAG_HANDLE}
          />
        );
      case "month-spend":
        return (
          <StatBlock
            title="This Month"
            value={summary?.month ?? 0}
            isLoading={isLoading}
            dragHandleClassName={DRAG_HANDLE}
          />
        );
      case "year-spend":
        return (
          <StatBlock
            title="This Year"
            value={summary?.year ?? 0}
            isLoading={isLoading}
            dragHandleClassName={DRAG_HANDLE}
          />
        );
      case "spend-line-chart":
        return <SpendChart data={stats?.dailySpend ?? []} isLoading={isLoading} />;
      case "category-pie-chart":
        return <TopStoresChart stores={stats?.topStores ?? []} isLoading={isLoading} />;
      case "recent-receipts":
        return <RecentReceiptsBlock />;
      case "top-stores":
        return <TopStoresListBlock stores={stats?.topStores ?? []} isLoading={isLoading} />;
      default:
        return null;
    }
  }

  if (layoutLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {/* Edit mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving && <span className="text-xs">Saving layout…</span>}
        </div>
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsEditMode(!isEditMode)}
          className="gap-2"
        >
          {isEditMode ? (
            <>
              <Lock className="h-3.5 w-3.5" /> Lock Layout
            </>
          ) : (
            <>
              <Unlock className="h-3.5 w-3.5" /> Edit Layout
            </>
          )}
        </Button>
      </div>

      {isEditMode && (
        <p className="text-xs text-muted-foreground mb-3">
          <GripVertical className="inline h-3 w-3 mr-1" />
          Drag blocks by their header to rearrange. Click &quot;Lock Layout&quot; when done.
        </p>
      )}

      <ResponsiveGridLayout
        className="layout"
        width={containerWidth ?? 1200}
        layouts={{ lg: layout, md: layout.map((l) => ({ ...l, w: Math.min(l.w, 6) })) }}
        breakpoints={{ lg: 1200, md: 768, sm: 480 }}
        cols={{ lg: 12, md: 6, sm: 2 }}
        rowHeight={60}
        dragConfig={{ enabled: isEditMode, bounded: false, threshold: 3, handle: `.${DRAG_HANDLE}` }}
        resizeConfig={{ enabled: isEditMode, handles: ["se"] }}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
      >
        {layout.map((block) => (
          <div key={block.i} data-grid={block}>
            <ErrorBoundary>{renderBlock(block.i)}</ErrorBoundary>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
