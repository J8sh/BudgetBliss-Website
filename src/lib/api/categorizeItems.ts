import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/finance/categories";

/**
 * Sorts receipt line items into spending categories with Claude. Used for stores that sell
 * across categories (Walmart, Target, gas stations), where the store name alone can't say
 * whether a purchase was groceries, cleaning supplies or a phone charger.
 */

const MODEL = "claude-opus-5-5";
export const MAX_ITEMS_PER_CALL = 120;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicApiKey });
  return _client;
}

export interface ItemToCategorize {
  /** Caller's reference, echoed back */
  ref: string;
  name: string;
  description?: string;
  store: string;
}

const ResultSchema = z.object({
  items: z.array(z.object({ ref: z.string(), category: z.enum(CATEGORY_IDS) })),
});

const SYSTEM = `You sort items from shopping receipts into personal-finance spending categories.

Categories (id: meaning):
${CATEGORY_IDS.map((id) => `- ${id}: ${CATEGORIES[id].label}. ${CATEGORIES[id].examples}`).join("\n")}

Receipt item names are often abbreviated store codes ("GV 2% MLK GAL", "ZIPLOC SNDWCH"); read them the way a cashier would. Food and drink bought to have at home is groceries, even at a gas station or big-box store; a hot food item eaten on the go (pizza slice, hot dog, fountain drink) is dining. Fuel is transportation. Use other only when nothing else fits. Return one entry per input item, with its ref unchanged.`;

export class CategorizeError extends Error {}

/** Categorizes up to MAX_ITEMS_PER_CALL items. Items Claude skips are left out of the result. */
export async function categorizeItems(items: ItemToCategorize[]): Promise<Map<string, CategoryId>> {
  if (items.length === 0) return new Map();
  if (items.length > MAX_ITEMS_PER_CALL) throw new CategorizeError(`At most ${MAX_ITEMS_PER_CALL} items per call`);

  const list = items
    .map((i) => JSON.stringify({ ref: i.ref, item: i.name, detail: i.description ?? undefined, store: i.store }))
    .join("\n");

  let response;
  try {
    response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
      messages: [{ role: "user", content: `Categorize these ${items.length} items:\n${list}` }],
    });
  } catch (err) {
    logger.error({ error: err }, "Claude item categorization failed");
    throw new CategorizeError("The categorization request failed");
  }

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    logger.warn({ stopReason: response.stop_reason }, "Claude returned no categories");
    throw new CategorizeError("No categories came back");
  }

  const known = new Set(items.map((i) => i.ref));
  return new Map(
    response.parsed_output.items.filter((r) => known.has(r.ref)).map((r) => [r.ref, r.category] as const),
  );
}
