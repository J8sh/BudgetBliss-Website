import { categoryFromText, guessMerchant, isExclusion, looksLikeTransfer, normalizeStoreName, storeChoiceLabel, CATEGORIES, CATEGORY_IDS } from "@/lib/finance/categories";

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
    expect(guessMerchant("Riverside Plaza")).toEqual({ key: "riverside plaza", name: "Riverside Plaza", mixed: false });
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

describe("bank and card descriptions", () => {
  it("groups rows whose only difference is a reference code", () => {
    const keys = ["Maple Apartments SIGONFILE H1YS", "Maple Apartments SIGONFILE DRSS", "Maple Apartments SIGONFILE 0SKR"].map(normalizeStoreName);
    expect(new Set(keys)).toEqual(new Set(["maple apartments sigonfile"]));
    expect(normalizeStoreName("EVERGY METRO AUTOPAY 532139873232")).toBe(normalizeStoreName("EVERGY METRO AUTOPAY 532658790880"));
    expect(normalizeStoreName("XX1111 POS PURCHASE AT SNACK KIOSK AUTO-R VENDCO MI WXYZ 024820")).toBe(
      normalizeStoreName("XX1111 POS PURCHASE AT SNACK KIOSK AUTO-R VENDCO MI WXYZ 065434"),
    );
    expect(normalizeStoreName("PAYPAL *STEAM GAMES")).toBe("steam games");
    expect(normalizeStoreName("7-ELEVEN 41629")).toBe("7-eleven");
  });

  it.each([
    ["WM SUPERCENTER #1599", "Walmart", "groceries"],
    ["WAL-MART #2855", "Walmart", "groceries"],
    ["WALMART STORE    02855", "Walmart", "groceries"],
    ["AMAZON PRIME*SK12W5BC3", "Amazon Prime", "subscriptions"],
    ["AMAZON MKTPL*5192W2IC2", "Amazon", "shopping"],
    ["PAYPAL *SPOTIFY*P482413", "Spotify", "subscriptions"],
    ["ANTHROPIC* CLAUDE SUB", "Claude", "subscriptions"],
    ["HY-VEE F&F 5508", "Hy-Vee Fast & Fresh", "transportation"],
    ["HY-VEE #1422", "Hy-Vee", "groceries"],
    ["QT 272 INSIDE", "QuikTrip", "transportation"],
    ["GFIBER", "Google Fiber", "housing"],
    ["GOOGLE *FIBER LKNVJ8", "Google Fiber", "housing"],
    ["STATE FARM INSURANCE", "State Farm Insurance", "housing"],
    ["EVERGY METRO AUTOPAY 532139873232", "Evergy Metro Autopay", "housing"],
    ["PAYPAL *STEAM GAMES", "Steam Games", "fun"],
    ["CINEMARK 259 ONLINE", "Cinemark", "fun"],
    ["FOX AND HOUND #65029", "Fox & Hound", "dining"],
    ["XX1111 POS PURCHASE AT CORNER CAFE 024820", "Corner Cafe", "dining"],
    ["EYECARE CENTER", "Eyecare Center", "health"],
    ["COUNTY MOTOR VEHICLE DEPT", "County Motor Vehicle", "transportation"],
    ["TSA DENVER STR 2406", "Tsa Denver Str", "travel"],
  ])("%s → %s (%s)", (description, name, category) => {
    const m = guessMerchant(description);
    expect(m.name).toBe(name);
    expect(m.category).toBe(category);
    expect(m.excluded).toBeUndefined();
  });

  it.each([
    "DISCOVER E-PAYMENT 1234",
    "DISCOVER CAP ONE MOBILE PMT CA06B119E4D13A3",
    "INTERNET PAYMENT - THANKYOU",
    "CAPITAL ONE MOBILE PYMT",
    "HSA - UMB BANK HSA Cont HSA - UMB Bank",
    "HSA - FUNDING VE HSA VTrans HSA - Funding V",
    "TRANSFER TO SAVINGS 4411",
    "VANGUARD BUY INVESTMENT",
  ])("recognizes %s as not spending", (description) => {
    expect(looksLikeTransfer(description)).toBe(true);
    expect(guessMerchant(description).excluded).toBe("transfer");
  });

  it.each(["EVERGY METRO AUTOPAY 532139873232", "Maple Apartments SIGONFILE H1YS", "DISCOVER", "VENMO CASHOUT"])(
    "doesn't treat %s as a transfer",
    (description) => expect(looksLikeTransfer(description)).toBe(false),
  );
});

describe("store choices", () => {
  it("labels categories and exclusions", () => {
    expect(storeChoiceLabel("groceries")).toBe("Groceries");
    expect(storeChoiceLabel("transfer")).toBe("Not spending");
    expect(storeChoiceLabel("bill")).toBe("Recurring bill (already counted)");
    expect(storeChoiceLabel("uncategorized")).toBe("Not sorted yet");
    expect(isExclusion("bill")).toBe(true);
    expect(isExclusion("groceries")).toBe(false);
  });
});
