import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface LineItemDoc {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number; // cents
  totalPrice: number; // cents
  category?: string;
}

export interface ReceiptDoc extends Document {
  imageHash?: string;
  imagePath?: string;
  imageUrl?: string;
  extractionMethod: "claude" | "manual" | "claude-partial" | "failed";
  extractionRaw?: string;
  storeName: string;
  storeAddress?: string;
  receiptDate: Date;
  paymentMethod?: "card" | "cash" | "other";
  cardLastFour?: string;
  lineItems: LineItemDoc[];
  /** All monetary fields are stored in cents (integer) */
  subtotal?: number;
  taxAmount?: number;
  grandTotal: number;
  notes?: string;
  tags: string[];
  isDuplicate: boolean;
  duplicateOf?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<LineItemDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, default: 1, min: 0 },
    unitPrice: { type: Number, required: true }, // cents; negative for discounts/refunds
    totalPrice: { type: Number, required: true }, // cents; negative for discounts/refunds
    category: { type: String, trim: true },
  },
  { _id: false },
);

const receiptSchema = new Schema<ReceiptDoc>(
  {
    imageHash: { type: String },
    imagePath: { type: String },
    imageUrl: { type: String },
    extractionMethod: {
      type: String,
      enum: ["claude", "manual", "claude-partial", "failed"],
      required: true,
      default: "manual",
    },
    extractionRaw: { type: String, select: false }, // excluded from default queries
    storeName: { type: String, required: true, trim: true },
    storeAddress: { type: String, trim: true },
    receiptDate: { type: Date, required: true, index: true },
    paymentMethod: { type: String, enum: ["card", "cash", "other"] },
    cardLastFour: {
      type: String,
      validate: {
        validator: (v: string) => /^\d{4}$/.test(v),
        message: "cardLastFour must be exactly 4 digits",
      },
    },
    lineItems: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, min: 0 }, // cents
    taxAmount: { type: Number, min: 0 }, // cents
    grandTotal: { type: Number, required: true, min: 0, index: true }, // cents
    notes: { type: String, trim: true },
    tags: { type: [String], default: [] },
    isDuplicate: { type: Boolean, default: false, index: true },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Receipt" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index for secondary duplicate check
receiptSchema.index({ storeName: 1, receiptDate: 1, grandTotal: 1 });
// Default sort index
receiptSchema.index({ createdAt: -1 });

// Unique index on imageHash — only enforced when the field is present (sparse)
receiptSchema.index({ imageHash: 1 }, { unique: true, sparse: true });

export const Receipt: Model<ReceiptDoc> =
  mongoose.models["Receipt"] ?? mongoose.model<ReceiptDoc>("Receipt", receiptSchema);
