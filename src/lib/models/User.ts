import mongoose, { type Document, type Model, Schema } from "mongoose";
import type { DashboardBlockLayout, Theme } from "@/types/dashboard";

export interface UserDoc extends Document {
  email: string;
  passwordHash: string;
  dashboardLayout: DashboardBlockLayout[];
  theme: Theme;
  createdAt: Date;
  updatedAt: Date;
}

const dashboardBlockLayoutSchema = new Schema<DashboardBlockLayout>(
  {
    i: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    w: { type: Number, required: true },
    h: { type: Number, required: true },
    minW: { type: Number, required: true, default: 2 },
    minH: { type: Number, required: true, default: 2 },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // excluded from default queries for security
    },
    dashboardLayout: {
      type: [dashboardBlockLayoutSchema],
      default: [],
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
  },
  { timestamps: true },
);

export const User: Model<UserDoc> =
  mongoose.models["User"] ?? mongoose.model<UserDoc>("User", userSchema);
