import mongoose, { type Document, type Model, Schema } from "mongoose";
import type { DashboardBlockLayout, Theme } from "@/types/dashboard";

export interface UserDoc extends Document {
  email: string;
  passwordHash: string;
  dashboardLayout: DashboardBlockLayout[];
  theme: Theme;
  twoFactorEnabled: boolean;
  totpSecretEnc?: string;
  totpPendingSecretEnc?: string;
  totpPendingCreatedAt?: Date;
  totpLastStep?: number;
  recoveryCodeHashes: string[];
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
    // Two-factor login (TOTP). Secrets are encrypted with lib/auth/secretBox and never selected by default.
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecretEnc: { type: String, select: false },
    totpPendingSecretEnc: { type: String, select: false },
    totpPendingCreatedAt: { type: Date, select: false },
    // Last time step a code was accepted for, so the same code can't be used twice
    totpLastStep: { type: Number, select: false },
    recoveryCodeHashes: { type: [String], default: [], select: false },
  },
  { timestamps: true },
);

export const User: Model<UserDoc> =
  mongoose.models["User"] ?? mongoose.model<UserDoc>("User", userSchema);
