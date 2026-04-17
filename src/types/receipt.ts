export type PaymentMethod = "card" | "cash" | "other";
export type ExtractionMethod = "claude" | "manual" | "claude-partial" | "failed";

export interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  /** Price in cents (integer) */
  unitPrice: number;
  /** Price in cents (integer) */
  totalPrice: number;
  category?: string;
}

export interface Receipt {
  _id: string;
  imageHash?: string;
  imagePath?: string;
  imageUrl?: string;
  extractionMethod: ExtractionMethod;
  extractionRaw?: string;
  storeName: string;
  storeAddress?: string;
  receiptDate: string; // ISO date string
  paymentMethod?: PaymentMethod;
  cardLastFour?: string;
  lineItems: LineItem[];
  /** Amount in cents */
  subtotal?: number;
  /** Amount in cents */
  taxAmount?: number;
  /** Amount in cents */
  grandTotal: number;
  notes?: string;
  tags: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by Claude API before conversion to cents */
export interface ExtractedReceipt {
  storeName: string | null;
  storeAddress: string | null;
  receiptDate: string | null; // YYYY-MM-DD
  paymentMethod: PaymentMethod | null;
  cardLastFour: string | null;
  lineItems: Array<{
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number; // decimal dollars
    totalPrice: number; // decimal dollars
  }>;
  subtotal: number | null;
  taxAmount: number | null;
  grandTotal: number | null;
}
