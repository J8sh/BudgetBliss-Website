import mongoose, { type Document, type Model, Schema } from "mongoose";
import { STORE_CHOICES, type StoreChoice } from "@/lib/finance/categories";

/**
 * A category you chose for a store (or "transfer" / "bill" to leave it out of spending);
 * applies to all of that store's receipts, past and future
 */
export interface MerchantRuleDoc extends Document {
  /** Merchant key from lib/finance/categories guessMerchant() */
  key: string;
  category: StoreChoice;
  createdAt: Date;
  updatedAt: Date;
}

const merchantRuleSchema = new Schema<MerchantRuleDoc>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, enum: STORE_CHOICES },
  },
  { timestamps: true },
);

export const MerchantRule: Model<MerchantRuleDoc> =
  mongoose.models["MerchantRule"] ?? mongoose.model<MerchantRuleDoc>("MerchantRule", merchantRuleSchema);
