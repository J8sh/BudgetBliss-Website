import { toCents, fromCents, formatCurrency, parseCurrencyToCents } from "@/lib/utils/currency";

describe("toCents", () => {
  it("converts whole dollar amounts", () => {
    expect(toCents(12)).toBe(1200);
    expect(toCents(0)).toBe(0);
    expect(toCents(100)).toBe(10000);
  });

  it("converts decimal dollar amounts", () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(12.50)).toBe(1250);
    expect(toCents(0.99)).toBe(99);
    expect(toCents(0.01)).toBe(1);
  });

  it("rounds floating point errors correctly", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.006)).toBe(101); // rounds up (1.006 * 100 = 100.6 → 101)
  });

  it("handles large amounts", () => {
    expect(toCents(9999.99)).toBe(999999);
  });
});

describe("fromCents", () => {
  it("converts cents to dollars", () => {
    expect(fromCents(1250)).toBe(12.5);
    expect(fromCents(100)).toBe(1);
    expect(fromCents(99)).toBe(0.99);
    expect(fromCents(0)).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats cents as USD currency string", () => {
    expect(formatCurrency(1250)).toBe("$12.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(100)).toBe("$1.00");
    expect(formatCurrency(99)).toBe("$0.99");
  });

  it("handles large amounts", () => {
    expect(formatCurrency(999999)).toBe("$9,999.99");
  });
});

describe("parseCurrencyToCents", () => {
  it("parses plain numbers", () => {
    expect(parseCurrencyToCents("12.50")).toBe(1250);
    expect(parseCurrencyToCents("12")).toBe(1200);
  });

  it("parses currency-prefixed strings", () => {
    expect(parseCurrencyToCents("$12.50")).toBe(1250);
    expect(parseCurrencyToCents("$0.99")).toBe(99);
  });

  it("returns null for unparseable input", () => {
    expect(parseCurrencyToCents("abc")).toBeNull();
    expect(parseCurrencyToCents("")).toBeNull();
  });
});
