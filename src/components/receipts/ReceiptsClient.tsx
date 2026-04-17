"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReceiptTable } from "./ReceiptTable";
import type { Receipt } from "@/types/receipt";

interface PaginatedReceipts {
  receipts: Receipt[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function ReceiptsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<PaginatedReceipts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentQuery = Object.fromEntries(searchParams.entries());

  const fetchReceipts = useCallback(async (query: Record<string, string>) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(query).filter(([, v]) => v !== "")),
      );
      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (res.ok) {
        setData(await res.json() as PaginatedReceipts);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReceipts(currentQuery);
  }, [searchParams.toString()]);

  function handleQueryChange(params: Record<string, string>) {
    const url = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "")),
    );
    router.push(`/receipts?${url.toString()}`);
  }

  return (
    <ReceiptTable
      receipts={data?.receipts ?? []}
      pagination={data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 }}
      onQueryChange={handleQueryChange}
      currentQuery={currentQuery}
      isLoading={isLoading}
    />
  );
}
