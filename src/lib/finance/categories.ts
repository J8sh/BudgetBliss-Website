/**
 * Spending categories and how purchases are sorted into them.
 *
 * Each category is a "need" or a "want", which is what the needs / wants / savings check
 * (the 50/30/20 rule of thumb) uses. The split is a common convention, not a judgment: anyone
 * can move a store to a different category.
 */

export const CATEGORY_IDS = [
  "groceries",
  "dining",
  "transportation",
  "household",
  "housing",
  "health",
  "shopping",
  "fun",
  "subscriptions",
  "personal",
  "travel",
  "gifts",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
/** A category id, or "uncategorized" when nothing has sorted the purchase yet */
export type CategoryKey = CategoryId | "uncategorized";
export type CategoryKind = "need" | "want";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  kind: CategoryKind;
  /** Shown under the name so it's clear what belongs where */
  examples: string;
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  groceries: { id: "groceries", label: "Groceries", kind: "need", examples: "Food and drinks for home" },
  dining: { id: "dining", label: "Dining & coffee", kind: "want", examples: "Restaurants, takeout, coffee shops" },
  transportation: { id: "transportation", label: "Gas & auto", kind: "need", examples: "Fuel, car parts, repairs, parking" },
  household: { id: "household", label: "Home & household", kind: "need", examples: "Cleaning, paper goods, tools, hardware" },
  housing: { id: "housing", label: "Housing & bills", kind: "need", examples: "Rent, utilities, internet, phone, insurance" },
  health: { id: "health", label: "Health & pharmacy", kind: "need", examples: "Medicine, doctor, dentist" },
  shopping: { id: "shopping", label: "Shopping", kind: "want", examples: "Clothes, electronics, furniture, decor" },
  fun: { id: "fun", label: "Fun & nights out", kind: "want", examples: "Movies, events, hobbies, books, alcohol" },
  subscriptions: { id: "subscriptions", label: "Subscriptions", kind: "want", examples: "Streaming, music, apps, memberships" },
  personal: { id: "personal", label: "Personal care", kind: "want", examples: "Haircuts, cosmetics, toiletries" },
  travel: { id: "travel", label: "Travel", kind: "want", examples: "Hotels, flights, trips" },
  gifts: { id: "gifts", label: "Gifts & giving", kind: "want", examples: "Presents, donations" },
  other: { id: "other", label: "Other", kind: "want", examples: "Anything that doesn't fit elsewhere" },
};

export const UNCATEGORIZED_LABEL = "Not sorted yet";

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryLabel(key: CategoryKey): string {
  return key === "uncategorized" ? UNCATEGORIZED_LABEL : CATEGORIES[key].label;
}

// ─── Free-text categories (line items, recurring costs) ──────────────────────

const TEXT_ALIASES: Array<[RegExp, CategoryId]> = [
  [/grocer|produce|food at home/i, "groceries"],
  [/dining|restaurant|takeout|coffee|fast food|meal/i, "dining"],
  [/\bgas\b|fuel|auto|car\b|vehicle|parking|transport|uber|lyft/i, "transportation"],
  [/rent|mortgage|utilit|electric|water|sewer|trash|internet|phone|insurance|housing|bill/i, "housing"],
  [/household|cleaning|hardware|home improvement|tools?\b|home\b/i, "household"],
  [/health|pharm|medic|doctor|dent|vision|prescription/i, "health"],
  [/music|stream|netflix|spotify|hulu|disney|subscription|app\b|membership|gym|software|cloud/i, "subscriptions"],
  [/cloth|apparel|electronic|shopping|furniture|decor/i, "shopping"],
  [/entertain|movie|event|concert|hobby|book|game|alcohol|beer|wine|liquor|bar\b|fun/i, "fun"],
  [/personal|beauty|cosmetic|toiletr|hair|salon/i, "personal"],
  [/travel|hotel|flight|airline|vacation/i, "travel"],
  [/gift|donat|charit/i, "gifts"],
];

/**
 * Maps a free-text category ("Groceries", "Rent", "Music", or one of our ids) onto a
 * category id. Returns undefined when nothing matches.
 */
export function categoryFromText(text: string | undefined | null): CategoryId | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if (isCategoryId(t.toLowerCase())) return t.toLowerCase() as CategoryId;
  const byLabel = CATEGORY_IDS.find((id) => CATEGORIES[id].label.toLowerCase() === t.toLowerCase());
  if (byLabel) return byLabel;
  return TEXT_ALIASES.find(([pattern]) => pattern.test(t))?.[1];
}

// ─── Stores ──────────────────────────────────────────────────────────────────

/**
 * Known stores. `mixed` stores sell across categories (a Walmart trip can be groceries,
 * cleaning supplies and a phone charger), so their receipts are split by line item when the
 * items are categorized; `category` is the fallback for the rest.
 * Rules are checked in order, so more specific names come first.
 */
interface StoreRule {
  match: RegExp;
  brand: string;
  category: CategoryId;
  mixed?: boolean;
}

const STORE_RULES: StoreRule[] = [
  // Big-box and warehouse stores
  { match: /wal-?mart/i, brand: "Walmart", category: "groceries", mixed: true },
  { match: /\btarget\b/i, brand: "Target", category: "shopping", mixed: true },
  { match: /costco/i, brand: "Costco", category: "groceries", mixed: true },
  { match: /sam'?s club/i, brand: "Sam's Club", category: "groceries", mixed: true },
  { match: /amazon|amzn/i, brand: "Amazon", category: "shopping", mixed: true },

  // Gas stations (often sell food too, so items decide when they're known)
  { match: /hy-?\s?vee fast/i, brand: "Hy-Vee Fast & Fresh", category: "transportation", mixed: true },
  { match: /dillons fuel/i, brand: "Dillons Fuel", category: "transportation", mixed: true },
  { match: /casey'?s/i, brand: "Casey's", category: "transportation", mixed: true },
  { match: /quik ?trip|\bqt\b/i, brand: "QuikTrip", category: "transportation", mixed: true },
  { match: /short ?stop/i, brand: "Short Stop", category: "transportation", mixed: true },
  { match: /minit ?mart/i, brand: "Minit Mart", category: "transportation", mixed: true },
  { match: /kwik ?(shop|trip|star)/i, brand: "Kwik Shop", category: "transportation", mixed: true },
  { match: /speedway|phillips|conoco|maverik|shell\b|sinclair|valero|\bbp\b|chevron|exxon|mobil\b|marathon|7-?eleven|express stop|lp mart|\bfuels?\b|petroleum/i, brand: "", category: "transportation", mixed: true },

  // Groceries
  { match: /hy-?\s?vee/i, brand: "Hy-Vee", category: "groceries" },
  { match: /\baldi\b/i, brand: "ALDI", category: "groceries" },
  { match: /dillons/i, brand: "Dillons", category: "groceries" },
  { match: /winco/i, brand: "WinCo Foods", category: "groceries" },
  { match: /trader joe/i, brand: "Trader Joe's", category: "groceries" },
  { match: /whole foods|sprouts|price chopper|sun fresh|natural grocers|kroger|cosentino|\bmarket\b|grocer/i, brand: "", category: "groceries" },

  // Car
  { match: /o'?reilly|autozone|advance auto|napa auto|jiffy lube|valvoline|\btires?\b|car wash|parking/i, brand: "", category: "transportation" },

  // Home
  { match: /ikea|menards|home depot|lowe'?s|ace hardware|harbor freight|hardware/i, brand: "", category: "household" },

  // Health
  { match: /cvs|walgreens|pharmacy|clinic|dental|dentist|optomet|urgent care|hospital/i, brand: "", category: "health" },

  // Fun
  { match: /cinemark|\bamc\b|theat(er|re)|cinema|andretti|recordbar|bowl|arcade|fireworks|total wine|liquor|wine|barnes ?& ?noble|books/i, brand: "", category: "fun" },

  // Shopping
  { match: /dick'?s|jcpenney|kohl'?s|old navy|best buy|micro ?center|world market|retail group|marshalls|tj ?maxx|ross\b|nordstrom|macy'?s/i, brand: "", category: "shopping" },

  // Dining (named chains first, then restaurant-ish words)
  { match: /starbucks/i, brand: "Starbucks", category: "dining" },
  { match: /mcdonald/i, brand: "McDonald's", category: "dining" },
  { match: /chipotle/i, brand: "Chipotle", category: "dining" },
  { match: /panda express/i, brand: "Panda Express", category: "dining" },
  { match: /domino'?s/i, brand: "Domino's", category: "dining" },
  { match: /restaurant|grill|pizza|pub\b|deli\b|taqueria|taco|cafe|caf[eé]|coffee|teriyaki|chicken|brew|taproom|bistro|sushi|bbq|burger|wings?\b|kitchen|diner|bakery|fox & hound|freddy|carrabba|sinbad|sinhad|el fogon|el alteno|snackle|mildred|meddys|peanut/i, brand: "", category: "dining" },
];

/** Lowercased store name without store numbers or punctuation noise ("Casey's Store #3254" → "casey's") */
export function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(store|restaurant|no\.?)\s*#?\s*\d+\b/g, " ")
    .replace(/#\s*\d+/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/^(welcome to|sq \*|tst\*|pos )\s*/g, "")
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MerchantGuess {
  /** Groups receipts from the same store ("walmart" for every Walmart format) */
  key: string;
  /** Name to show */
  name: string;
  /** Suggested category, if the name is recognized */
  category?: CategoryId;
  /** Sells across categories, so line items decide when they're categorized */
  mixed: boolean;
}

/** Recognizes a store and suggests its category */
export function guessMerchant(storeName: string): MerchantGuess {
  const normalized = normalizeStoreName(storeName) || "unknown";
  const rule = STORE_RULES.find((r) => r.match.test(storeName));
  if (!rule) return { key: normalized, name: storeName.trim(), mixed: false };
  return {
    key: rule.brand ? rule.brand.toLowerCase() : normalized,
    name: rule.brand || storeName.trim(),
    category: rule.category,
    mixed: rule.mixed ?? false,
  };
}
