"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { useIncome } from "@/hooks/useIncome";
import { IncomeDialog } from "./IncomeDialog";
import type { Income, IncomeFrequency, IncomeCategory } from "@/types/income";

const FREQ_LABELS: Record<IncomeFrequency, string> = {
  weekly: "/wk",
  monthly: "/mo",
  quarterly: "/qtr",
  yearly: "/yr",
};

const CATEGORY_ICONS: Record<IncomeCategory, string> = {
  employment: "💼",
  freelance: "🧑‍💻",
  investments: "📈",
  passive: "🏠",
  other: "📋",
};

const CATEGORY_LABELS: Record<IncomeCategory, string> = {
  employment: "Employment",
  freelance: "Freelance",
  investments: "Investments",
  passive: "Passive",
  other: "Other",
};

interface IncomeSourcesBlockProps {
  dragHandleClassName?: string;
}

export function IncomeSourcesBlock({ dragHandleClassName }: IncomeSourcesBlockProps) {
  const { items, isLoading, refetch } = useIncome();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Income | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditItem(undefined);
    setDialogOpen(true);
  }

  function openEdit(item: Income) {
    setEditItem(item);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/income/${id}`, { method: "DELETE" });
      refetch();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className={`pb-2 shrink-0 flex flex-row items-center justify-between ${dragHandleClassName ?? ""}`}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Income Sources</CardTitle>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={openAdd} title="Add income source">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <p className="text-sm text-muted-foreground">No income sources yet.</p>
              <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add one
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      {item.category && (
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0 gap-1"
                        >
                          <span>{CATEGORY_ICONS[item.category]}</span>
                          <span>{CATEGORY_LABELS[item.category]}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums text-green-600 dark:text-green-400 font-medium">
                      +{formatCurrency(item.amount)}
                      <span className="text-xs text-muted-foreground ml-0.5">{FREQ_LABELS[item.frequency]}</span>
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(item._id)}
                        disabled={deletingId === item._id}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editItem}
        onSuccess={refetch}
      />
    </>
  );
}
