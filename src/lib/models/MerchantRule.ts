import mongoose, { type Document, type Model, Schema } from "mongoose";
import { CATEGORY_IDS, type CategoryId } from "@/lib/finance/categories";

/** A category you chose for a store; applies to all of that store's receipts, past and future */
export interface MerchantRuleDoc extends Document {
  /** Merchant key from lib/finance/categories guessMerchant() */
  key: string;
  category: CategoryId;
  createdAt: Date;
  updatedAt: Date;
}

const merchantRuleSchema = new Schema<MerchantRuleDoc>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, enum: CATEGORY_IDS },
  },
  { timestamps: true },
);

export const MerchantRule: Model<MerchantRuleDoc> =
  mongoose.models["MerchantRule"] ?? mongoose.model<MerchantRuleDoc>("MerchantRule", merchantRuleSchema);
