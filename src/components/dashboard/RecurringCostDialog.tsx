"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromCents, parseCurrencyToCents } from "@/lib/utils/currency";
import type { RecurringCost, RecurringFrequency } from "@/types/recurringCost";
import { RECURRING_FREQUENCIES } from "@/lib/utils/validators";

interface RecurringCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RecurringCost;
  onSuccess: () => void;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RecurringCostDialog({ open, onOpenChange, item, onSuccess }: RecurringCostDialogProps) {
  const isEdit = !!item;

  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setAmountStr(item ? String(fromCents(item.amount)) : "");
      setFrequency(item?.frequency ?? "monthly");
      setCategory(item?.category ?? "");
      setNotes(item?.notes ?? "");
      setError(null);
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = parseCurrencyToCents(amountStr);
    if (!cents || cents < 1) {
      setError("Enter a valid amount greater than $0.00");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const payload = { name: name.trim(), amount: cents, frequency, category: category.trim() || undefined, notes: notes.trim() || undefined };

    setIsSaving(true);
    try {
      const url = isEdit ? `/api/recurring/${item._id}` : "/api/recurring";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Request failed");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recurring Cost" : "Add Recurring Cost"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rc-name">Name</Label>
            <Input
              id="rc-name"
              placeholder="e.g. Netflix"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-amount">Amount</Label>
              <Input
                id="rc-amount"
                placeholder="$0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-frequency">Frequency</Label>
              <select
                id="rc-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-category">Category <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="rc-category"
              placeholder="e.g. Subscriptions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="rc-notes"
              placeholder="Any additional details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Cost"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
