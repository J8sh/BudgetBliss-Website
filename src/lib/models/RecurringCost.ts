import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface RecurringCostDoc extends Document {
  name: string;
  amount: number; // cents
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  category?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const recurringCostSchema = new Schema<RecurringCostDoc>(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 }, // cents, integer
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      required: true,
    },
    category: { type: String, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const RecurringCost: Model<RecurringCostDoc> =
  mongoose.models["RecurringCost"] ??
  mongoose.model<RecurringCostDoc>("RecurringCost", recurringCostSchema);
