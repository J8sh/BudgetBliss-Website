import { detectDelimiter, guardFormula, parseCsv, rowToRecord, toCsv, unguardFormula } from "@/lib/csv/csv";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const { headers, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([["1", "2", "3"], ["4", "5", "6"]]);
  });

  it("handles quotes, escaped quotes, delimiters and newlines inside quotes", () => {
    const { rows } = parseCsv('name,notes\n"Smith, Jo","said ""hi""\nthen left"\n');
    expect(rows).toEqual([["Smith, Jo", 'said "hi"\nthen left']]);
  });

  it("handles CRLF, a BOM, blank lines and a missing final newline", () => {
    const { headers, rows } = parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter('"x;y",b,c\n')).toBe(",");
    expect(parseCsv("a;b\n1,5;2").rows).toEqual([["1,5", "2"]]);
  });

  it("trims header names", () => {
    expect(parseCsv(" Date , Amount \n1,2").headers).toEqual(["Date", "Amount"]);
  });
});

describe("rowToRecord", () => {
  it("maps cells to headers, filling short rows", () => {
    expect(rowToRecord(["a", "b", "c"], [" 1 ", "2"])).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("toCsv", () => {
  it("escapes fields that need quoting and adds a BOM", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", "plain"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",plain\r\n');
  });

  it("round-trips through parseCsv", () => {
    const rows = [["1", "a, b", 'q"uote'], ["2", "", "multi\nline"]];
    const parsed = parseCsv(toCsv(["id", "x", "y"], rows));
    expect(parsed.rows).toEqual(rows);
  });
});

describe("formula guarding", () => {
  it("prefixes cells spreadsheets would run as formulas, and undoes it", () => {
    for (const value of ["=SUM(A1)", "+1", "-cmd", "@x"]) {
      expect(guardFormula(value)).toBe(`'${value}`);
      expect(unguardFormula(guardFormula(value))).toBe(value);
    }
    expect(guardFormula("Starbucks")).toBe("Starbucks");
    expect(unguardFormula("'quoted")).toBe("'quoted");
  });
});
