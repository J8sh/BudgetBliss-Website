import {
  detectDateFormat,
  formatCentsForCsv,
  parseAmountToCents,
  parseBoolean,
  parseDateToIso,
} from "@/lib/csv/values";

describe("formatCentsForCsv", () => {
  it("formats cents as plain decimal dollars", () => {
    expect(formatCentsForCsv(1250)).toBe("12.50");
    expect(formatCentsForCsv(5)).toBe("0.05");
    expect(formatCentsForCsv(-300)).toBe("-3.00");
    expect(formatCentsForCsv(0)).toBe("0.00");
    expect(formatCentsForCsv(undefined)).toBe("");
  });
});

describe("parseAmountToCents", () => {
  it.each([
    ["12.50", 1250],
    ["$1,234.56", 123456],
    ["-12.34", -1234],
    ["(12.34)", -1234],
    ["12.34-", -1234],
    ["+5", 500],
    ["$ 0.99", 99],
    [".5", 50],
    ["19.999", 2000],
    ["19.994", 1999],
    ["-$4.10", -410],
  ])("parses %s", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it("avoids float rounding errors", () => {
    expect(parseAmountToCents("1.15")).toBe(115);
    expect(parseAmountToCents("4.35")).toBe(435);
  });

  it.each(["", "abc", "1.2.3", "$"])("rejects %j", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });

  it("treats commas as thousands separators", () => {
    expect(parseAmountToCents("1,000")).toBe(100000);
  });
});

describe("parseDateToIso", () => {
  it("reads ISO dates, with or without a time", () => {
    expect(parseDateToIso("2026-03-14")).toBe("2026-03-14");
    expect(parseDateToIso("2026-3-4")).toBe("2026-03-04");
    expect(parseDateToIso("2026-03-14T10:00:00Z")).toBe("2026-03-14");
    expect(parseDateToIso("2026/03/14")).toBe("2026-03-14");
  });

  it("reads US month-first dates by default", () => {
    expect(parseDateToIso("03/04/2026")).toBe("2026-03-04");
    expect(parseDateToIso("3/4/26")).toBe("2026-03-04");
  });

  it("reads day-first dates when told, or when the first part can't be a month", () => {
    expect(parseDateToIso("03/04/2026", "dmy")).toBe("2026-04-03");
    expect(parseDateToIso("14/03/2026")).toBe("2026-03-14");
  });

  it("rejects impossible dates", () => {
    expect(parseDateToIso("2026-02-30")).toBeNull();
    expect(parseDateToIso("13/13/2026")).toBeNull();
    expect(parseDateToIso("yesterday")).toBeNull();
    expect(parseDateToIso("")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("picks day-first only when a first part is over 12", () => {
    expect(detectDateFormat(["01/02/2026", "03/04/2026"])).toBe("mdy");
    expect(detectDateFormat(["01/02/2026", "25/04/2026"])).toBe("dmy");
    expect(detectDateFormat(["2026-01-25"])).toBe("mdy");
  });
});

describe("parseBoolean", () => {
  it("reads common spellings", () => {
    expect(parseBoolean("TRUE")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("")).toBeUndefined();
    expect(parseBoolean("maybe")).toBeNull();
  });
});
