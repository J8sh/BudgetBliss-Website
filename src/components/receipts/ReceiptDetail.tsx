"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit2, Trash2, AlertTriangle, ExternalLink, CreditCard, Banknote } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils/currency";
import type { Receipt } from "@/types/receipt";

interface ReceiptDetailProps {
  receipt: Receipt;
}

export function ReceiptDetail({ receipt }: ReceiptDetailProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/receipts/${receipt._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Receipt deleted.");
        router.push("/receipts");
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to delete receipt.");
      }
    } catch {
      toast.error("Connection error.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  async function dismissDuplicate() {
    try {
      await fetch(`/api/receipts/${receipt._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDuplicate: false }),
      });
      toast.success("Duplicate flag dismissed.");
      router.refresh();
    } catch {
      toast.error("Failed to update receipt.");
    }
  }

  const PaymentIcon = receipt.paymentMethod === "card" ? CreditCard : Banknote;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{receipt.storeName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date(receipt.receiptDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/receipts/${receipt._id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {receipt.isDuplicate && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
              Possible Duplicate Receipt
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-0.5">
              This receipt may be a duplicate of{" "}
              {receipt.duplicateOf ? (
                <Link href={`/receipts/${receipt.duplicateOf}`} className="underline">
                  another receipt <ExternalLink className="inline h-3 w-3" />
                </Link>
              ) : (
                "another receipt"
              )}
              .
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={dismissDuplicate} className="shrink-0">
            Dismiss
          </Button>
        </div>
      )}

      {(receipt.extractionMethod === "failed" || receipt.extractionMethod === "claude-partial") && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-400 bg-orange-50 dark:bg-orange-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-400">
              {receipt.extractionMethod === "failed" ? "Extraction Failed" : "Partial Extraction"}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-500 mt-0.5">
              Some receipt data could not be extracted automatically. Please review and edit.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Image */}
        {receipt.imageUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receipt Image</CardTitle>
            </CardHeader>
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receipt.imageUrl}
                alt={`Receipt from ${receipt.storeName}`}
                className="w-full rounded-md object-contain bg-muted max-h-96"
              />
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Store</span>
                <span className="font-medium">{receipt.storeName}</span>
              </div>
              {receipt.storeAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="text-right max-w-48">{receipt.storeAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(receipt.receiptDate).toLocaleDateString()}</span>
              </div>
              {receipt.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="flex items-center gap-1 capitalize">
                    <PaymentIcon className="h-3.5 w-3.5" />
                    {receipt.paymentMethod}
                    {receipt.cardLastFour ? ` ···${receipt.cardLastFour}` : ""}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {receipt.extractionMethod.replace("-", " ")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {receipt.subtotal != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(receipt.subtotal)}</span>
                </div>
              )}
              {receipt.taxAmount != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(receipt.taxAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(receipt.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

          {receipt.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{receipt.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Line Items */}
      {receipt.lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Line Items ({receipt.lineItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lineItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span>{item.name}</span>
                      {item.description && (
                        <span className="block text-xs text-muted-foreground">{item.description}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(item.totalPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              This will permanently delete the receipt from {receipt.storeName} and its associated
              image. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
