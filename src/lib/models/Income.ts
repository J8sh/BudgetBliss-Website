import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface IncomeDoc extends Document {
  name: string;
  amount: number; // cents
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  category?: "employment" | "freelance" | "investments" | "passive" | "other";
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const incomeSchema = new Schema<IncomeDoc>(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 }, // cents, integer
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      required: true,
    },
    category: {
      type: String,
      enum: ["employment", "freelance", "investments", "passive", "other"],
    },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const Income: Model<IncomeDoc> =
  mongoose.models["Income"] ?? mongoose.model<IncomeDoc>("Income", incomeSchema);
