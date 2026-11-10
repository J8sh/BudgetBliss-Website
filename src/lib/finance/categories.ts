/**
 * Spending categories and how purchases are sorted into them.
 *
 * Each category is a "need" or a "want", which is what the needs / wants / savings check
 * (the 50/30/20 rule of thumb) uses. The split is a common convention, not a judgment: anyone
 * can move a store to a different category.
 *
 * Some bank rows aren't spending at all (paying off a credit card, moving money to savings) or
 * are already counted elsewhere (rent that's on the recurring bills list). Those are
 * "exclusions": they stay in the database but never count toward spending.
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

// ─── Not spending ────────────────────────────────────────────────────────────

export const EXCLUSION_KINDS = ["transfer", "bill"] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

export const EXCLUSIONS: Record<ExclusionKind, { label: string; description: string }> = {
  transfer: {
    label: "Not spending",
    description: "Credit card payments, transfers between your accounts, savings, HSA and investment contributions",
  },
  bill: {
    label: "Recurring bill (already counted)",
    description: "Payments for a bill that's on your recurring bills list, so it isn't counted twice",
  },
};

/** What a store can be set to: a spending category, or one of the exclusions */
export type StoreChoice = CategoryId | ExclusionKind;
export const STORE_CHOICES = [...CATEGORY_IDS, ...EXCLUSION_KINDS] as const;

export function isExclusion(value: unknown): value is ExclusionKind {
  return typeof value === "string" && (EXCLUSION_KINDS as readonly string[]).includes(value);
}

export function storeChoiceLabel(value: StoreChoice | "uncategorized"): string {
  return isExclusion(value) ? EXCLUSIONS[value].label : categoryLabel(value);
}

/**
 * Bank rows that move money rather than spend it. The purchases behind a card payment are
 * imported from the card itself, and savings/HSA/investment contributions are money kept.
 */
const TRANSFER_PATTERNS: RegExp[] = [
  // Paying a credit card from checking
  /\b(discover|capital one|cap one|chase|citi(card)?|amex|american express|barclays|synchrony|apple card|card ?services|credit card)\b.*\b(pmt|pymt|payment|e-?payment|autopay|epay)\b/i,
  /\b(e-?payment|epay|online payment|mobile pmt|mobile pymt)\b.*\b(discover|capital one|chase|citi|amex|barclays|synchrony)\b/i,
  /\bpayment\s*-?\s*thank\s*you\b/i,
  // Money kept, not spent
  /^hsa\b|\bhsa (cont|contribution|funding)\b/i,
  /\b(transfer|xfer)\b.*\b(to|from)\b.*\b(savings|checking|brokerage|share|account)\b/i,
  /\b(vanguard|fidelity|schwab|robinhood|wealthfront|betterment|acorns|coinbase|e\*?trade)\b/i,
];

export function looksLikeTransfer(description: string): boolean {
  return TRANSFER_PATTERNS.some((p) => p.test(description));
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
 * Known stores, matched against receipt store names and bank descriptions ("WM SUPERCENTER
 * #1599", "PAYPAL *STEAM GAMES"). `mixed` stores sell across categories (a Walmart trip can be
 * groceries, cleaning supplies and a phone charger), so their receipts are split by line item
 * when the items are categorized; `category` is the fallback for the rest.
 * Rules are checked in order, so more specific names come first.
 */
interface StoreRule {
  match: RegExp;
  brand: string;
  category: CategoryId;
  mixed?: boolean;
}

const STORE_RULES: StoreRule[] = [
  // Subscriptions and online services (before the stores they share names with)
  { match: /amazon prime|prime video/i, brand: "Amazon Prime", category: "subscriptions" },
  { match: /spotify/i, brand: "Spotify", category: "subscriptions" },
  { match: /netflix|hulu|disney ?\+|disney plus|max\.com|hbo ?max|youtube premium|paramount/i, brand: "", category: "subscriptions" },
  { match: /anthropic|claude\.ai/i, brand: "Claude", category: "subscriptions" },
  { match: /hackthebox|hack the box/i, brand: "Hack The Box", category: "subscriptions" },
  { match: /leetcode|github|namecheap|microsoft|apple\.com\/bil|google \*(?!fiber)|openai|chatgpt/i, brand: "", category: "subscriptions" },

  // Bills
  { match: /g ?fiber|google \*?fiber/i, brand: "Google Fiber", category: "housing" },
  { match: /evergy|electric|water dept|utilit/i, brand: "", category: "housing" },
  { match: /state farm|geico|progressive|allstate|insurance/i, brand: "", category: "housing" },

  // Big-box and warehouse stores
  { match: /wal-?mart|\bwm supercenter\b/i, brand: "Walmart", category: "groceries", mixed: true },
  { match: /\btarget\b/i, brand: "Target", category: "shopping", mixed: true },
  { match: /costco/i, brand: "Costco", category: "groceries", mixed: true },
  { match: /sam'?s club|\bsams store\b/i, brand: "Sam's Club", category: "groceries", mixed: true },
  { match: /amazon|amzn/i, brand: "Amazon", category: "shopping", mixed: true },
  { match: /ebay/i, brand: "eBay", category: "shopping" },

  // Gas stations (often sell food too, so items decide when they're known)
  { match: /hy-?\s?vee (fast|f&f)/i, brand: "Hy-Vee Fast & Fresh", category: "transportation", mixed: true },
  { match: /dillons fuel/i, brand: "Dillons Fuel", category: "transportation", mixed: true },
  { match: /casey'?s/i, brand: "Casey's", category: "transportation", mixed: true },
  { match: /quik ?trip|\bqt\b/i, brand: "QuikTrip", category: "transportation", mixed: true },
  { match: /short ?stop/i, brand: "Short Stop", category: "transportation", mixed: true },
  { match: /minit ?mart/i, brand: "Minit Mart", category: "transportation", mixed: true },
  { match: /kwik ?(shop|trip|star)/i, brand: "Kwik Shop", category: "transportation", mixed: true },
  { match: /speedway|phillips|conoco|maverik|shell\b|sinclair|valero|\bbp\b|chevron|exxon|mobil\b|marathon|amoco|7-?eleven|express stop|lp mart|\bfuels?\b|petroleum/i, brand: "", category: "transportation", mixed: true },

  // Groceries
  { match: /hy-?\s?vee/i, brand: "Hy-Vee", category: "groceries" },
  { match: /\baldi\b/i, brand: "ALDI", category: "groceries" },
  { match: /dillons/i, brand: "Dillons", category: "groceries" },
  { match: /winco/i, brand: "WinCo Foods", category: "groceries" },
  { match: /trader joe/i, brand: "Trader Joe's", category: "groceries" },
  { match: /whole foods|sprouts|price chopper|sun fresh|natural grocers|kroger|cosentino|\bmarket\b|grocer/i, brand: "", category: "groceries" },

  // Car
  { match: /o'?reilly|autozone|advance auto|napa auto|rock ?auto|jiffy lube|valvoline|\btires?\b|car wash|parking|motor vehicle|\bdmv\b/i, brand: "", category: "transportation" },

  // Home
  { match: /ikea|menards|home depot|lowe'?s|ace hardware|harbor freight|hardware/i, brand: "", category: "household" },

  // Health
  { match: /cvs|walgreens|pharmacy|clinic|dental|dentist|optomet|eyecare|eye care|zenni|urgent care|hospital/i, brand: "", category: "health" },

  // Travel
  { match: /\btsa\b|airline|airport|hotel|marriott|hilton|airbnb|expedia/i, brand: "", category: "travel" },

  // Fun
  { match: /cinemark/i, brand: "Cinemark", category: "fun" },
  { match: /steam games|epic games|g2a|jagex|playstation|nintendo|xbox/i, brand: "", category: "fun" },
  { match: /\bamc\b|theat(er|re)|cinema|andretti|bowl|lanes\b|arcade|fireworks|total wine|liquor|wine|barnes ?& ?noble|books|k1 speed|motorsportreg|signup|climbing/i, brand: "", category: "fun" },

  // Shopping
  { match: /dick'?s|jcpenney|kohl'?s|old navy|best buy|micro ?center|world market|retail group|crutchfield|marshalls|tj ?maxx|ross\b|nordstrom|macy'?s/i, brand: "", category: "shopping" },

  // Dining (named chains first, then restaurant-ish words)
  { match: /starbucks/i, brand: "Starbucks", category: "dining" },
  { match: /mcdonald/i, brand: "McDonald's", category: "dining" },
  { match: /chipotle/i, brand: "Chipotle", category: "dining" },
  { match: /panda express/i, brand: "Panda Express", category: "dining" },
  { match: /domino'?s/i, brand: "Domino's", category: "dining" },
  { match: /fox (&|and) hound/i, brand: "Fox & Hound", category: "dining" },
  { match: /freddy'?s/i, brand: "Freddy's", category: "dining" },
  { match: /restaurant|grill|pizza|pub\b|deli\b|taqueria|taco|cafe|caf[eé]|coffee|teriyaki|chicken|brew|taproom|bistro|sushi|bbq|burger|wings?\b|kitchen|diner|bakery|bakehouse|roast|carrabba|jimmy john|jersey mike|panera|buffalo wild|concession|stad conc/i, brand: "", category: "dining" },
];

/** Words that only describe how a bank or card network processed a payment */
const PAYMENT_PREFIX = /^(xx\d+\s+)?(pos\s+(purchase|withdrawal|debit adj\.*|debit)\s+(at\s+)?)?(paypal \*|pp\*|sq \*|tst\*|fsp\*|act\*|msr\* ?|welcome to )?/;

/**
 * A stable key for a store name or bank description, so every visit groups together:
 * "Casey's Store #3254" → "casey's", "Maple Apartments SIGONFILE H1YS" → "maple apartments sigonfile".
 * Store numbers and reference codes are dropped, and only the first three words are kept.
 */
export function normalizeStoreName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(PAYMENT_PREFIX, "")
    .replace(/\b(store|restaurant|no\.?)\s*#?\s*\d+\b/g, " ")
    .replace(/#\s*\d+/g, " ")
    .replace(/[^a-z0-9&' -]/g, " ");
  const words = cleaned
    .split(/\s+/)
    .filter((w) => /[a-z]/.test(w)) // drop bare numbers and punctuation
    .filter((w) => !(/\d/.test(w) && w.length >= 4 && !w.includes("-"))); // drop reference codes like h1ys, ca06b119
  return words.slice(0, 3).join(" ");
}

function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export interface MerchantGuess {
  /** Groups receipts from the same store ("walmart" for every Walmart format) */
  key: string;
  /** Name to show */
  name: string;
  /** Suggested category, if the name is recognized */
  category?: CategoryId;
  /** Recognized as a transfer rather than spending (card payment, savings) */
  excluded?: ExclusionKind;
  /** Sells across categories, so line items decide when they're categorized */
  mixed: boolean;
}

/** Recognizes a store (or a transfer) and suggests its category */
export function guessMerchant(storeName: string): MerchantGuess {
  const normalized = normalizeStoreName(storeName) || "unknown";
  if (looksLikeTransfer(storeName)) {
    return { key: normalized, name: titleCase(normalized), excluded: "transfer", mixed: false };
  }
  const rule = STORE_RULES.find((r) => r.match.test(storeName));
  if (!rule) return { key: normalized, name: titleCase(normalized), mixed: false };
  return {
    key: rule.brand ? rule.brand.toLowerCase() : normalized,
    name: rule.brand || titleCase(normalized),
    category: rule.category,
    mixed: rule.mixed ?? false,
  };
}
