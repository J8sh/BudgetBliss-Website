"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import type { Receipt } from "@/types/receipt";

interface SortIconProps {
  field: string;
  currentQuery: Record<string, string>;
}

function SortIcon({ field, currentQuery }: SortIconProps) {
  if (currentQuery["sortBy"] !== field) {
    return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
  }
  return (
    <ArrowUpDown
      className={`h-3 w-3 ml-1 ${currentQuery["sortOrder"] === "asc" ? "rotate-180" : ""} text-primary`}
    />
  );
}

interface ReceiptTableProps {
  receipts: Receipt[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onQueryChange: (params: Record<string, string>) => void;
  currentQuery: Record<string, string>;
  isLoading?: boolean;
}

export function ReceiptTable({
  receipts,
  pagination,
  onQueryChange,
  currentQuery,
  isLoading,
}: ReceiptTableProps) {
  const [searchInput, setSearchInput] = useState(currentQuery["search"] ?? "");

  const handleSearch = useCallback(
    (value: string) => {
      onQueryChange({ ...currentQuery, search: value, page: "1" });
    },
    [currentQuery, onQueryChange],
  );

  function toggleSort(field: string) {
    const isCurrent = currentQuery["sortBy"] === field;
    const nextOrder = isCurrent && currentQuery["sortOrder"] === "asc" ? "desc" : "asc";
    onQueryChange({ ...currentQuery, sortBy: field, sortOrder: nextOrder, page: "1" });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by store name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(searchInput)}
            onBlur={() => handleSearch(searchInput)}
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={currentQuery["dateFrom"] ?? ""}
            onChange={(e) => onQueryChange({ ...currentQuery, dateFrom: e.target.value, page: "1" })}
            className="w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={currentQuery["dateTo"] ?? ""}
            onChange={(e) => onQueryChange({ ...currentQuery, dateTo: e.target.value, page: "1" })}
            className="w-40"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("storeName")}>
                  Store <SortIcon field="storeName" currentQuery={currentQuery} />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("receiptDate")}>
                  Date <SortIcon field="receiptDate" currentQuery={currentQuery} />
                </button>
              </TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("grandTotal")}>
                  Total <SortIcon field="grandTotal" currentQuery={currentQuery} />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Loading receipts…
                </TableCell>
              </TableRow>
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No receipts found. <Link href="/upload" className="text-primary underline">Upload one?</Link>
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow key={receipt._id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{receipt.storeName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(receipt.receiptDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {receipt.paymentMethod ?? "—"}
                    {receipt.cardLastFour ? ` ···${receipt.cardLastFour}` : ""}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatCurrency(receipt.grandTotal)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {receipt.isDuplicate && (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
                          Duplicate?
                        </Badge>
                      )}
                      {receipt.extractionMethod === "failed" && (
                        <Badge variant="destructive" className="text-xs">
                          Needs Review
                        </Badge>
                      )}
                      {receipt.extractionMethod === "claude-partial" && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-400">
                          Partial
                        </Badge>
                      )}
                      {receipt.extractionMethod === "manual" && (
                        <Badge variant="secondary" className="text-xs">Manual</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/receipts/${receipt._id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="View receipt">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onQueryChange({ ...currentQuery, page: String(pagination.page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onQueryChange({ ...currentQuery, page: String(pagination.page + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
