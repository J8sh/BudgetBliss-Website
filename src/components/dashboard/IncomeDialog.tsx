"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromCents, parseCurrencyToCents } from "@/lib/utils/currency";
import type { Income, IncomeFrequency, IncomeCategory } from "@/types/income";
import { RECURRING_FREQUENCIES, INCOME_CATEGORIES } from "@/lib/utils/validators";

interface IncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Income;
  onSuccess: () => void;
}

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const CATEGORY_LABELS: Record<IncomeCategory, string> = {
  employment: "💼 Employment",
  freelance: "🧑‍💻 Freelance",
  investments: "📈 Investments",
  passive: "🏠 Passive / Rental",
  other: "📋 Other",
};

export function IncomeDialog({ open, onOpenChange, item, onSuccess }: IncomeDialogProps) {
  const isEdit = !!item;

  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [frequency, setFrequency] = useState<IncomeFrequency>("monthly");
  const [category, setCategory] = useState<IncomeCategory | "">("");
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

    const payload = {
      name: name.trim(),
      amount: cents,
      frequency,
      category: category || undefined,
      notes: notes.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const url = isEdit ? `/api/income/${item._id}` : "/api/income";
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
          <DialogTitle>{isEdit ? "Edit Income Source" : "Add Income Source"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name">Name</Label>
            <Input
              id="inc-name"
              placeholder="e.g. Monthly Salary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-amount">Amount</Label>
              <Input
                id="inc-amount"
                placeholder="$0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inc-frequency">Frequency</Label>
              <select
                id="inc-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-category">Category <span className="text-muted-foreground">(optional)</span></Label>
            <select
              id="inc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as IncomeCategory | "")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Select category —</option>
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="inc-notes"
              placeholder="Any additional details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Add Income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
