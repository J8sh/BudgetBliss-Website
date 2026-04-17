import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { toCents } from "@/lib/utils/currency";
import type { ExtractedReceipt } from "@/types/receipt";

// claude-haiku-4-5-20251001 is the most cost-effective model for structured extraction
const MODEL = "claude-haiku-4-5-20251001" as const;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a receipt data extraction assistant.
Extract structured data from receipt images with high accuracy.
Always respond with valid JSON only — no markdown, no explanation, no code blocks.
If a field is not visible or not applicable, use null.
For monetary values, return numbers with exactly 2 decimal places as a plain number (e.g., 12.50, not "$12.50").
For dates, return ISO 8601 format: YYYY-MM-DD.`;

const USER_PROMPT = `Extract all data from this receipt image and return a JSON object matching this exact schema:

{
  "storeName": "string | null",
  "storeAddress": "string | null",
  "receiptDate": "YYYY-MM-DD string | null",
  "paymentMethod": "card | cash | other | null",
  "cardLastFour": "4-digit string | null",
  "lineItems": [
    {
      "name": "string",
      "description": "string | null",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "subtotal": "number | null",
  "taxAmount": "number | null",
  "grandTotal": "number | null"
}

Rules:
- cardLastFour: only include if paymentMethod is "card" and last 4 digits are visible on the receipt
- lineItems: include every item on the receipt; if quantity is not shown, default to 1
- description: any extra product detail printed on the receipt for that line item (brand, size/weight, variant, PLU/item code, promotional label); use null if no additional detail is visible
- All monetary values: decimal numbers only, no currency symbols (e.g., 12.50 not "$12.50")
- If this image is not a receipt, return exactly: {"error":"not_a_receipt"}`;

/** Zod schema for validating Claude's response */
const ExtractedReceiptSchema = z.object({
  storeName: z.string().min(1).nullable(),
  storeAddress: z.string().nullable(),
  receiptDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  paymentMethod: z.enum(["card", "cash", "other"]).nullable(),
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  lineItems: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      quantity: z.number().min(0),
      unitPrice: z.number(),
      totalPrice: z.number(),
    }),
  ),
  subtotal: z.number().min(0).nullable(),
  taxAmount: z.number().min(0).nullable(),
  grandTotal: z.number().min(0).nullable(),
});

export class NotAReceiptError extends Error {
  constructor() {
    super("The uploaded image does not appear to be a receipt.");
    this.name = "NotAReceiptError";
  }
}

export class ClaudeApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ClaudeApiError";
  }
}

export class ClaudeParseError extends Error {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(message);
    this.name = "ClaudeParseError";
  }
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/gm, "")
    .replace(/```$/gm, "")
    .trim();
}

function parseClaudeJson(raw: string): ExtractedReceipt {
  const cleaned = stripMarkdownFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ClaudeParseError("Claude returned invalid JSON", cleaned);
  }

  // Check for explicit not-a-receipt signal
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "error" in parsed &&
    (parsed as Record<string, unknown>)["error"] === "not_a_receipt"
  ) {
    throw new NotAReceiptError();
  }

  const result = ExtractedReceiptSchema.parse(parsed);
  return result;
}

/** Convert decimal dollar values from Claude to integer cents */
function convertToCents(extracted: ExtractedReceipt): ExtractedReceipt & {
  subtotalCents?: number;
  taxAmountCents?: number;
  grandTotalCents?: number;
} {
  return {
    ...extracted,
    lineItems: extracted.lineItems.map((item) => ({
      ...item,
      description: item.description ?? undefined,
      unitPrice: toCents(item.unitPrice),
      totalPrice: toCents(item.totalPrice),
    })),
    subtotal: extracted.subtotal !== null ? toCents(extracted.subtotal) : null,
    taxAmount: extracted.taxAmount !== null ? toCents(extracted.taxAmount) : null,
    grandTotal: extracted.grandTotal !== null ? toCents(extracted.grandTotal) : null,
  };
}

/**
 * Sends an image to Claude API and extracts structured receipt data.
 * All monetary values in the returned object are in integer cents.
 *
 * @param imageBuffer - WebP image buffer (already optimized for Claude)
 * @param rawResponse - Optional storage for the raw Claude response (for debugging)
 */
export async function extractReceiptData(
  imageBuffer: Buffer,
  rawResponse?: { value: string },
): Promise<ExtractedReceipt> {
  const base64Image = imageBuffer.toString("base64");

  let responseText: string;

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/webp",
                data: base64Image,
              },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
        // Prefill forces the response to start with "{" — prevents markdown fences entirely
        { role: "assistant", content: "{" },
      ],
    });

    const content = response.content[0];
    if (!content || content.type !== "text") {
      throw new ClaudeApiError("Unexpected response format from Claude API");
    }
    // Prepend the prefilled "{" that the API continued from
    responseText = "{" + content.text;
  } catch (err) {
    if (err instanceof ClaudeApiError) throw err;
    logger.error({ error: err }, "Claude API call failed");
    throw new ClaudeApiError("Claude API request failed", err);
  }

  // Store raw response if requested (for debugging)
  if (rawResponse) {
    rawResponse.value = responseText;
  }

  // Attempt to parse the response
  try {
    const extracted = parseClaudeJson(responseText);
    return convertToCents(extracted);
  } catch (err) {
    if (err instanceof NotAReceiptError) throw err;

    // Retry once with a correction prompt
    logger.warn({ raw: responseText }, "Claude returned invalid JSON, retrying with correction prompt");

    try {
      const retryResponse = await getClient().messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/webp", data: base64Image },
              },
              { type: "text", text: USER_PROMPT },
            ],
          },
          { role: "assistant", content: responseText },
          {
            role: "user",
            content:
              "Your previous response was invalid — it may have been truncated or wrapped in markdown. Look at the receipt image again and return a complete, valid JSON object with ALL line items. Start with { and end with }. No markdown, no code blocks.",
          },
          // Prefill on retry too
          { role: "assistant", content: "{" },
        ],
      });

      const retryContent = retryResponse.content[0];
      if (!retryContent || retryContent.type !== "text") {
        throw new ClaudeParseError("Retry response was empty");
      }

      // Prepend the prefilled "{"
      const retryText = "{" + retryContent.text;

      if (rawResponse) {
        rawResponse.value = retryText;
      }

      const extracted = parseClaudeJson(retryText);
      return convertToCents(extracted);
    } catch (retryErr) {
      if (retryErr instanceof NotAReceiptError) throw retryErr;
      logger.error({ error: retryErr }, "Claude extraction failed after retry");
      throw new ClaudeParseError("Failed to extract structured data from receipt after retry");
    }
  }
}
