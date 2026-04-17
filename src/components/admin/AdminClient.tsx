"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/currency";
import type { Receipt } from "@/types/receipt";

interface PaginatedResponse {
  receipts: Receipt[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export function AdminClient() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchAll() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/receipts?limit=50&sortBy=createdAt&sortOrder=desc");
      if (res.ok) setData(await res.json() as PaginatedResponse);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void fetchAll(); }, []);

  async function handleDelete(id: string) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Receipt deleted.");
        await fetchAll();
      } else {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Failed to delete.");
      }
    } catch {
      toast.error("Connection error.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  const needsReview = data?.receipts.filter(
    (r) => r.extractionMethod === "failed" || r.extractionMethod === "claude-partial",
  ) ?? [];

  const duplicates = data?.receipts.filter((r) => r.isDuplicate) ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.pagination.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Needs Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{needsReview.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Flagged Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{duplicates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/upload">
              <Button size="sm" variant="outline" className="w-full">
                Upload
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Needs review alert */}
      {needsReview.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-400 bg-orange-50 dark:bg-orange-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-400">
              {needsReview.length} receipt{needsReview.length !== 1 ? "s" : ""} need manual review
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-500 mt-0.5">
              Claude could not fully extract data from these receipts. Click to edit them.
            </p>
          </div>
        </div>
      )}

      {/* Receipt table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Store</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (data?.receipts ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No receipts yet.
                </TableCell>
              </TableRow>
            ) : (
              (data?.receipts ?? []).map((r) => (
                <TableRow
                  key={r._id}
                  className={
                    r.extractionMethod === "failed"
                      ? "bg-destructive/5"
                      : r.extractionMethod === "claude-partial"
                        ? "bg-orange-50/50 dark:bg-orange-950/10"
                        : ""
                  }
                >
                  <TableCell className="font-medium">{r.storeName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.receiptDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(r.grandTotal)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {r.extractionMethod.replace("-", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {r.isDuplicate && (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                          Dup?
                        </Badge>
                      )}
                      {r.extractionMethod === "failed" && (
                        <Badge variant="destructive" className="text-xs">Review</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/receipts/${r._id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(r._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              This will permanently delete the receipt and its image. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
