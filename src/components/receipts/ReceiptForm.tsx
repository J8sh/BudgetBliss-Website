"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toCents, formatCurrency } from "@/lib/utils/currency";
import type { CreateReceiptInput } from "@/lib/utils/validators";

interface ReceiptFormProps {
  /** Pre-populated values (e.g., from Claude extraction result for correction) */
  defaultValues?: Partial<CreateReceiptInput>;
  onSubmit: (data: CreateReceiptInput) => Promise<void>;
  isLoading?: boolean;
  /** Optional image shown alongside the form for reference */
  imageUrl?: string;
}

interface LineItemInput {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

export function ReceiptForm({ defaultValues, onSubmit, isLoading, imageUrl }: ReceiptFormProps) {
  const [storeName, setStoreName] = useState(defaultValues?.storeName ?? "");
  const [storeAddress, setStoreAddress] = useState(defaultValues?.storeAddress ?? "");
  const [receiptDate, setReceiptDate] = useState(
    defaultValues?.receiptDate ?? new Date().toISOString().split("T")[0] ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "other" | "">(
    defaultValues?.paymentMethod ?? "",
  );
  const [cardLastFour, setCardLastFour] = useState(defaultValues?.cardLastFour ?? "");
  const [subtotal, setSubtotal] = useState(
    defaultValues?.subtotal ? (defaultValues.subtotal / 100).toFixed(2) : "",
  );
  const [taxAmount, setTaxAmount] = useState(
    defaultValues?.taxAmount ? (defaultValues.taxAmount / 100).toFixed(2) : "",
  );
  const [grandTotal, setGrandTotal] = useState(
    defaultValues?.grandTotal ? (defaultValues.grandTotal / 100).toFixed(2) : "",
  );
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  const [lineItems, setLineItems] = useState<LineItemInput[]>(
    defaultValues?.lineItems?.map((item) => ({
      name: item.name,
      description: item.description ?? "",
      quantity: item.quantity.toString(),
      unitPrice: (item.unitPrice / 100).toFixed(2),
      totalPrice: (item.totalPrice / 100).toFixed(2),
    })) ?? [],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  function addLineItem() {
    setLineItems((prev) => [...prev, { name: "", description: "", quantity: "1", unitPrice: "", totalPrice: "" }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItemInput, value: string) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!storeName.trim()) errs["storeName"] = "Store name is required";
    if (!receiptDate) errs["receiptDate"] = "Date is required";
    if (!grandTotal || isNaN(parseFloat(grandTotal))) errs["grandTotal"] = "Grand total is required";
    if (paymentMethod === "card" && cardLastFour && !/^\d{4}$/.test(cardLastFour)) {
      errs["cardLastFour"] = "Must be exactly 4 digits";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateReceiptInput = {
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim() || undefined,
      receiptDate,
      paymentMethod: paymentMethod || undefined,
      cardLastFour: paymentMethod === "card" && cardLastFour ? cardLastFour : undefined,
      lineItems: lineItems
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          description: item.description.trim() || undefined,
          quantity: parseInt(item.quantity) || 1,
          unitPrice: toCents(parseFloat(item.unitPrice) || 0),
          totalPrice: toCents(parseFloat(item.totalPrice) || 0),
        })),
      subtotal: subtotal ? toCents(parseFloat(subtotal)) : undefined,
      taxAmount: taxAmount ? toCents(parseFloat(taxAmount)) : undefined,
      grandTotal: toCents(parseFloat(grandTotal)),
      notes: notes.trim() || undefined,
      tags: [],
    };

    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: form fields */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="storeName">
                  Store Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Whole Foods Market"
                  disabled={isLoading}
                />
                {errors["storeName"] && <p className="text-xs text-destructive">{errors["storeName"]}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="storeAddress">Address</Label>
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="123 Main St, Austin TX"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="receiptDate">
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="receiptDate"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  disabled={isLoading}
                />
                {errors["receiptDate"] && <p className="text-xs text-destructive">{errors["receiptDate"]}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "card" | "cash" | "other" | "")}
                  disabled={isLoading}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select…</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-1">
                  <Label htmlFor="cardLastFour">Last 4 Digits</Label>
                  <Input
                    id="cardLastFour"
                    value={cardLastFour}
                    onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="4242"
                    maxLength={4}
                    inputMode="numeric"
                    disabled={isLoading}
                  />
                  {errors["cardLastFour"] && <p className="text-xs text-destructive">{errors["cardLastFour"]}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="subtotal">Subtotal ($)</Label>
                  <Input
                    id="subtotal"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxAmount">Tax ($)</Label>
                  <Input
                    id="taxAmount"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grandTotal">
                    Total ($) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="grandTotal"
                    value={grandTotal}
                    onChange={(e) => setGrandTotal(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    disabled={isLoading}
                  />
                  {errors["grandTotal"] && <p className="text-xs text-destructive">{errors["grandTotal"]}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={3}
              disabled={isLoading}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
        </div>

        {/* Right: image + line items */}
        <div className="space-y-4">
          {imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Image</CardTitle>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Receipt" className="w-full rounded-md object-contain max-h-64 bg-muted" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem} disabled={isLoading}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items added yet. Click &quot;Add Item&quot; to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="space-y-2">
                      {index > 0 && <Separator />}
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-5 space-y-1">
                          <Label className="text-xs">Item Name</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateLineItem(index, "name", e.target.value)}
                            placeholder="Organic Milk"
                            disabled={isLoading}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                            placeholder="1"
                            inputMode="numeric"
                            disabled={isLoading}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Unit $</Label>
                          <Input
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                            disabled={isLoading}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Total $</Label>
                          <Input
                            value={item.totalPrice}
                            onChange={(e) => updateLineItem(index, "totalPrice", e.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                            disabled={isLoading}
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="col-span-1 pt-5">
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            disabled={isLoading}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          placeholder="Brand, size, variant, promo…"
                          disabled={isLoading}
                          className="text-sm h-8"
                        />
                      </div>
                    </div>
                  ))}

                  {lineItems.length > 0 && (
                    <div className="text-right text-sm text-muted-foreground pt-2 border-t border-border">
                      {lineItems.length} item{lineItems.length !== 1 ? "s" : ""} ·{" "}
                      {formatCurrency(
                        lineItems.reduce((sum, item) => sum + toCents(parseFloat(item.totalPrice) || 0), 0),
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving…" : "Save Receipt"}
        </Button>
      </div>
    </form>
  );
}
