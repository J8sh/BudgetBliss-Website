"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ExportType } from "@/types/dataTransfer";

const EXPORTS: Array<{ type: ExportType; label: string; detail: string; usesDates: boolean }> = [
  { type: "receipts", label: "Receipts", detail: "One row per receipt", usesDates: true },
  { type: "line-items", label: "Line items", detail: "One row per item bought", usesDates: true },
  { type: "income", label: "Income sources", detail: "All income sources", usesDates: false },
  { type: "recurring", label: "Recurring costs", detail: "All recurring costs", usesDates: false },
];

export function ExportCard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function exportUrl(type: ExportType, usesDates: boolean): string {
    const params = new URLSearchParams({ type });
    if (usesDates && from) params.set("from", from);
    if (usesDates && to) params.set("to", to);
    return `/api/export?${params.toString()}`;
  }

  const rangeInvalid = !!from && !!to && from > to;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          CSV files that open in Excel, Numbers or Google Sheets. Edit them and import them back to update records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="exportFrom">Receipts from</Label>
            <Input id="exportFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exportTo">to</Label>
            <Input id="exportTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">Leave empty for everything.</p>
        </div>
        {rangeInvalid && <p className="text-sm text-destructive">The start date is after the end date.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          {EXPORTS.map(({ type, label, detail, usesDates }) => (
            <a
              key={type}
              href={rangeInvalid && usesDates ? undefined : exportUrl(type, usesDates)}
              download
              aria-disabled={rangeInvalid && usesDates}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-auto justify-start gap-3 px-3 py-2.5 text-left",
                rangeInvalid && usesDates && "pointer-events-none opacity-50",
              )}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {detail}
                  {usesDates && (from || to) ? ", in the date range" : ""}
                </span>
              </span>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
