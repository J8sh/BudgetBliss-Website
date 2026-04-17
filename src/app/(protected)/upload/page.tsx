import type { Metadata } from "next";
import { UploadClient } from "@/components/upload/UploadClient";

export const metadata: Metadata = {
  title: "Upload Receipt — BudgetBliss",
};

export default function UploadPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Upload Receipt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an image or take a photo — Claude will extract the data automatically.
        </p>
      </div>
      <UploadClient />
    </div>
  );
}
