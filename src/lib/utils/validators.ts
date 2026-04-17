import { z } from "zod";

/** Zod schema for a single line item (values already in cents) */
export const LineItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int(),
  totalPrice: z.number().int(),
  category: z.string().optional(),
});

/** Zod schema for creating a receipt manually */
export const CreateReceiptSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  storeAddress: z.string().optional(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  paymentMethod: z.enum(["card", "cash", "other"]).optional(),
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/, "Must be 4 digits")
    .optional(),
  lineItems: z.array(LineItemSchema).default([]),
  subtotal: z.number().int().min(0).optional(),
  taxAmount: z.number().int().min(0).optional(),
  grandTotal: z.number().int().min(0, "Grand total is required"),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type CreateReceiptInput = z.infer<typeof CreateReceiptSchema>;

/** Zod schema for updating an existing receipt */
export const UpdateReceiptSchema = CreateReceiptSchema.partial().extend({
  isDuplicate: z.boolean().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateReceiptInput = z.infer<typeof UpdateReceiptSchema>;

/** Zod schema for receipt list query parameters */
export const ReceiptListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentMethod: z.enum(["card", "cash", "other"]).optional(),
  isDuplicate: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  sortBy: z.enum(["receiptDate", "createdAt", "grandTotal", "storeName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ReceiptListQuery = z.infer<typeof ReceiptListQuerySchema>;
