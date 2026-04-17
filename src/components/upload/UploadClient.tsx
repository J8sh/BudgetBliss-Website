"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUploadZone } from "./FileUploadZone";
import { CameraCapture } from "./CameraCapture";
import { ReceiptForm } from "@/components/receipts/ReceiptForm";
import type { CreateReceiptInput } from "@/lib/utils/validators";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; receiptId: string; isDuplicate?: boolean; duplicateOf?: string }
  | { status: "failed"; imageUrl?: string; imageHash?: string; imagePath?: string; errorMessage: string }
  | { status: "not-a-receipt" };

export function UploadClient() {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<"image" | "manual">("image");
  const [isSavingManual, setIsSavingManual] = useState(false);

  async function handleImageUpload(file: File) {
    setUploadState({ status: "uploading" });

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (res.status === 409) {
        toast.error("This receipt has already been uploaded.");
        setUploadState({ status: "idle" });
        return;
      }

      if (res.status === 422) {
        setUploadState({ status: "not-a-receipt" });
        return;
      }

      if (!res.ok) {
        const message = (data["error"] as string | undefined) ?? "Upload failed";
        setUploadState({
          status: "failed",
          errorMessage: message,
          imageUrl: data["imageUrl"] as string | undefined,
          imageHash: data["imageHash"] as string | undefined,
          imagePath: data["imagePath"] as string | undefined,
        });
        return;
      }

      const receipt = data["receipt"] as Record<string, unknown>;
      setUploadState({
        status: "success",
        receiptId: receipt["_id"] as string,
        isDuplicate: receipt["isDuplicate"] as boolean | undefined,
        duplicateOf: receipt["duplicateOf"] as string | undefined,
      });
    } catch {
      setUploadState({
        status: "failed",
        errorMessage: "Connection error. Please try again.",
      });
    }
  }

  async function handleManualSubmit(data: CreateReceiptInput) {
    setIsSavingManual(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        toast.error((json["error"] as string | undefined) ?? "Failed to save receipt");
        return;
      }

      const receipt = json["receipt"] as Record<string, unknown>;
      toast.success("Receipt saved successfully!");
      router.push(`/receipts/${receipt["_id"] as string}`);
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsSavingManual(false);
    }
  }

  function reset() {
    setUploadState({ status: "idle" });
  }

  // ─── Success state ────────────────────────────────────────────────────────────
  if (uploadState.status === "success") {
    return (
      <div className="max-w-md mx-auto text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Receipt Saved!</h2>
          {uploadState.isDuplicate && (
            <Badge variant="outline" className="mt-2 text-yellow-600 border-yellow-400">
              Possible Duplicate
            </Badge>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset}>
            Upload Another
          </Button>
          <Button onClick={() => router.push(`/receipts/${uploadState.receiptId}`)}>
            View Receipt
          </Button>
        </div>
      </div>
    );
  }

  // ─── Not a receipt state ─────────────────────────────────────────────────────
  if (uploadState.status === "not-a-receipt") {
    return (
      <div className="max-w-md mx-auto text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
        <div>
          <h2 className="text-xl font-semibold">Not a Receipt</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The uploaded image doesn&apos;t appear to be a receipt. Please try a different image.
          </p>
        </div>
        <Button onClick={reset}>Try Again</Button>
      </div>
    );
  }

  // ─── Failed state (image saved, but extraction failed) ───────────────────────
  if (uploadState.status === "failed" && uploadState.imageUrl) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {uploadState.errorMessage} The image was saved — please complete the form below.
          </AlertDescription>
        </Alert>
        <ReceiptForm
          imageUrl={uploadState.imageUrl}
          onSubmit={handleManualSubmit}
          isLoading={isSavingManual}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "image" | "manual")}>
        <TabsList>
          <TabsTrigger value="image">Image Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-6 space-y-4">
          {uploadState.status === "uploading" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Uploading and analyzing your receipt…
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploadZone onFileSelect={handleImageUpload} />

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <CameraCapture onCapture={handleImageUpload} />

              {uploadState.status === "failed" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{uploadState.errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <ReceiptForm onSubmit={handleManualSubmit} isLoading={isSavingManual} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
