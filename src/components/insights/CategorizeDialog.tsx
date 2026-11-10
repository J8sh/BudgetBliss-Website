"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatWholeDollars } from "@/lib/utils/currency";
import { CATEGORIES, CATEGORY_IDS, EXCLUSIONS, EXCLUSION_KINDS, storeChoiceLabel, type StoreChoice } from "@/lib/finance/categories";
import { useMerchants } from "@/hooks/useInsights";
import type { CategorySource, MerchantSummary } from "@/types/insights";

interface CategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after anything changed, so the report can refresh */
  onChanged: () => void;
}

const SOURCE_LABELS: Record<CategorySource, string> = {
  yours: "Your choice",
  store: "Suggested",
  items: "Split by item",
  none: "Not sorted",
};

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground sm:w-48";

/**
 * Sort stores into categories. A choice applies to every receipt from that store, past and
 * future. Stores that sell everything (Walmart, gas stations) can instead be split item by
 * item, which Claude can do in bulk.
 */
export function CategorizeDialog({ open, onOpenChange, onChanged }: CategorizeDialogProps) {
  const { merchants, isLoading, refetch } = useMerchants(open);
  const [filter, setFilter] = useState<"unsorted" | "all">("unsorted");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(0);

  const unsortedCount = merchants.filter((m) => m.category === "uncategorized").length;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    void fetch("/api/insights/categorize-items")
      .then((r) => (r.ok ? (r.json() as Promise<{ remaining: number }>) : null))
      .then((d) => setAiRemaining(d?.remaining ?? null))
      .catch(() => setAiRemaining(null));
  }, [open]);

  // Start on "Needs sorting" only when there is something to sort
  useEffect(() => {
    if (open && !isLoading) setFilter(unsortedCount > 0 ? "unsorted" : "all");
  }, [open, isLoading, unsortedCount]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merchants.filter(
      (m) => (filter === "all" || m.category === "uncategorized") && (!q || m.name.toLowerCase().includes(q)),
    );
  }, [merchants, filter, search]);

  async function setCategory(m: MerchantSummary, value: string) {
    setSaving(m.key);
    try {
      const res = await fetch("/api/insights/merchants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: m.key, category: value === "" ? null : value }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        value === ""
          ? `${m.name} is back to its suggested category.`
          : `${m.name} → ${storeChoiceLabel(value as StoreChoice)}, for all ${m.visits} ${m.visits === 1 ? "receipt" : "receipts"}.`,
      );
      refetch();
      onChanged();
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function sortWithAi() {
    setAiRunning(true);
    setAiDone(0);
    let total = 0;
    try {
      // Each call sorts one batch; keep going until nothing is left or a batch makes no progress
      for (let i = 0; i < 50; i++) {
        const res = await fetch("/api/insights/categorize-items", { method: "POST" });
        const data = (await res.json()) as { categorized?: number; remaining?: number; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Sorting stopped early.");
          break;
        }
        total += data.categorized ?? 0;
        setAiDone(total);
        setAiRemaining(data.remaining ?? 0);
        if (!data.categorized || !data.remaining) break;
      }
      if (total > 0) toast.success(`Sorted ${total} items.`);
    } catch {
      toast.error("Connection lost while sorting. What's done is saved.");
    } finally {
      setAiRunning(false);
      refetch();
      onChanged();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sort stores into categories</DialogTitle>
          <DialogDescription>
            Pick a category once and it applies to every receipt from that store, including future ones. Card payments
            and transfers to savings are left out automatically; mark rent or utility payments you already list as
            recurring bills as &quot;Recurring bill&quot; so they aren&apos;t counted twice.
          </DialogDescription>
        </DialogHeader>

        {aiRemaining !== null && (aiRemaining > 0 || aiRunning || aiDone > 0) && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">Split mixed stores by item</p>
              <p className="text-muted-foreground">
                {aiRunning
                  ? `Sorting… ${aiDone} done, ${aiRemaining} to go.`
                  : aiRemaining > 0
                    ? `${aiRemaining} items from stores like Walmart and gas stations can be sorted one by one (groceries vs. household vs. fuel). Item names are sent to Claude, like receipt photos already are.`
                    : `Done: ${aiDone} items sorted.`}
              </p>
            </div>
            {aiRemaining > 0 && (
              <Button onClick={sortWithAi} disabled={aiRunning} className="shrink-0 gap-1.5">
                <Sparkles className="h-4 w-4" />
                {aiRunning ? "Sorting…" : "Sort items"}
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1" role="tablist" aria-label="Which stores to show">
            <Button
              role="tab"
              aria-selected={filter === "unsorted"}
              variant={filter === "unsorted" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("unsorted")}
            >
              Needs sorting ({unsortedCount})
            </Button>
            <Button role="tab" aria-selected={filter === "all"} variant={filter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setFilter("all")}>
              All stores ({merchants.length})
            </Button>
          </div>
          <Input
            placeholder="Find a store…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:ml-auto sm:w-56"
            aria-label="Find a store"
          />
        </div>

        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {isLoading && merchants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading stores…</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filter === "unsorted" && !search ? "Every store has a category. Nice." : "No stores match."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((m) => (
                <li key={m.key} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {m.visits} {m.visits === 1 ? "receipt" : "receipts"} · {formatWholeDollars(m.total)}
                      </span>
                      <Badge variant={m.source === "none" ? "outline" : "secondary"} className="h-4 px-1.5 text-[10px]">
                        {SOURCE_LABELS[m.source]}
                      </Badge>
                    </p>
                  </div>
                  <select
                    className={selectClass}
                    aria-label={`Category for ${m.name}`}
                    value={m.source === "yours" ? m.category : ""}
                    disabled={saving === m.key}
                    onChange={(e) => void setCategory(m, e.target.value)}
                  >
                    <option value="">
                      {m.source === "yours"
                        ? m.suggested
                          ? `Use suggestion (${storeChoiceLabel(m.suggested)})`
                          : "Clear my choice"
                        : m.category === "uncategorized"
                          ? "Choose a category…"
                          : `${storeChoiceLabel(m.category)}${m.source === "items" ? " (by item)" : " (suggested)"}`}
                    </option>
                    <optgroup label="Spending">
                      {CATEGORY_IDS.map((id) => (
                        <option key={id} value={id}>
                          {CATEGORIES[id].label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Not counted as spending">
                      {EXCLUSION_KINDS.map((kind) => (
                        <option key={kind} value={kind} title={EXCLUSIONS[kind].description}>
                          {EXCLUSIONS[kind].label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
