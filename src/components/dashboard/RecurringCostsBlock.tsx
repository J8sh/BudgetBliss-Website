"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, RepeatIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { useRecurring } from "@/hooks/useRecurring";
import { RecurringCostDialog } from "./RecurringCostDialog";
import type { RecurringCost, RecurringFrequency } from "@/types/recurringCost";

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: "/wk",
  monthly: "/mo",
  quarterly: "/qtr",
  yearly: "/yr",
};

interface RecurringCostsBlockProps {
  dragHandleClassName?: string;
}

export function RecurringCostsBlock({ dragHandleClassName }: RecurringCostsBlockProps) {
  const { items, isLoading, refetch } = useRecurring();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringCost | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditItem(undefined);
    setDialogOpen(true);
  }

  function openEdit(item: RecurringCost) {
    setEditItem(item);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/recurring/${id}`, { method: "DELETE" });
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
            <RepeatIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Costs</CardTitle>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={openAdd} title="Add recurring cost">
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
              <p className="text-sm text-muted-foreground">No recurring costs yet.</p>
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
                        <Badge variant="secondary" className="text-xs shrink-0">{item.category}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums">
                      {formatCurrency(item.amount)}
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

      <RecurringCostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editItem}
        onSuccess={refetch}
      />
    </>
  );
}
