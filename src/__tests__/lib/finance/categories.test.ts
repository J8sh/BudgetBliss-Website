import { categoryFromText, guessMerchant, normalizeStoreName, CATEGORIES, CATEGORY_IDS } from "@/lib/finance/categories";

describe("normalizeStoreName", () => {
  it("drops store numbers and punctuation noise", () => {
    expect(normalizeStoreName("Casey's Store #3254")).toBe("casey's");
    expect(normalizeStoreName("Minit Mart 600603")).toBe("minit mart");
    expect(normalizeStoreName("Welcome to Short Stop")).toBe("short stop");
    expect(normalizeStoreName("  Starbucks Coffee #70736 ")).toBe("starbucks coffee");
  });
});

describe("guessMerchant", () => {
  it.each([
    ["Walmart", "walmart", "groceries", true],
    ["Walmart Supercenter", "walmart", "groceries", true],
    ["Walmart Neighborhood Market", "walmart", "groceries", true],
    ["Target", "target", "shopping", true],
    ["Hy-Vee", "hy-vee", "groceries", false],
    ["Hy Vee", "hy-vee", "groceries", false],
    ["Hy-Vee Fast & Fresh", "hy-vee fast & fresh", "transportation", true],
    ["Casey's Store #3254", "casey's", "transportation", true],
    ["CASEY'S", "casey's", "transportation", true],
    ["DILLONS FUEL #54", "dillons fuel", "transportation", true],
    ["Dillons", "dillons", "groceries", false],
    ["ALDI", "aldi", "groceries", false],
    ["O'Reilly Auto Parts", "o'reilly auto parts", "transportation", false],
    ["Starbucks Coffee #70736", "starbucks", "dining", false],
    ["McDonald's Restaurant #22234", "mcdonald's", "dining", false],
    ["Carrabba's Italian Grill", "carrabba's italian grill", "dining", false],
    ["CINEMARK", "cinemark", "fun", false],
    ["Total Wine", "total wine", "fun", false],
    ["IKEA Merriam", "ikea merriam", "household", false],
    ["Micro Center", "micro center", "shopping", false],
  ])("%s → %s / %s", (name, key, category, mixed) => {
    const m = guessMerchant(name);
    expect(m.key).toBe(key);
    expect(m.category).toBe(category);
    expect(m.mixed).toBe(mixed);
  });

  it("groups every Walmart format under one name", () => {
    expect(guessMerchant("Walmart Supercenter").name).toBe("Walmart");
  });

  it("leaves unrecognized stores uncategorized, keyed by their normalized name", () => {
    expect(guessMerchant("Overland Park")).toEqual({ key: "overland park", name: "Overland Park", mixed: false });
  });

  it("doesn't match tire inside other words", () => {
    expect(guessMerchant("Entire Office Supply").category).toBeUndefined();
  });
});

describe("categoryFromText", () => {
  it("accepts ids, labels and common words", () => {
    expect(categoryFromText("groceries")).toBe("groceries");
    expect(categoryFromText("Dining & coffee")).toBe("dining");
    expect(categoryFromText("Gas")).toBe("transportation");
    expect(categoryFromText("Rent")).toBe("housing");
    expect(categoryFromText("Music")).toBe("subscriptions");
    expect(categoryFromText("Dining")).toBe("dining");
  });

  it("returns undefined for empty or unknown text", () => {
    expect(categoryFromText(undefined)).toBeUndefined();
    expect(categoryFromText("")).toBeUndefined();
    expect(categoryFromText("zzz")).toBeUndefined();
  });
});

describe("CATEGORIES", () => {
  it("defines every id as a need or a want", () => {
    for (const id of CATEGORY_IDS) {
      expect(["need", "want"]).toContain(CATEGORIES[id].kind);
      expect(CATEGORIES[id].id).toBe(id);
    }
  });
});
