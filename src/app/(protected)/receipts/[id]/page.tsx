import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongoose";
import { Receipt } from "@/lib/models/Receipt";
import { ReceiptDetail } from "@/components/receipts/ReceiptDetail";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    await connectDB();
    const receipt = await Receipt.findById(id).select("storeName receiptDate").lean();
    if (!receipt) return { title: "Receipt Not Found — BudgetBliss" };
    return {
      title: `${receipt.storeName} — BudgetBliss`,
    };
  } catch {
    return { title: "Receipt — BudgetBliss" };
  }
}

export default async function ReceiptDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session) return notFound();

  const { id } = await params;

  await connectDB();
  const receipt = await Receipt.findById(id).lean();
  if (!receipt) return notFound();

  // Serialize for client component
  const serialized = JSON.parse(JSON.stringify({ ...receipt, _id: receipt._id.toString() }));

  return <ReceiptDetail receipt={serialized} />;
}
