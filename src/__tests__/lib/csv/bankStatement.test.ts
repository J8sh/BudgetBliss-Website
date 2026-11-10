import { parseCsv } from "@/lib/csv/csv";
import { guessBankMapping, readBankRows, validateBankMapping } from "@/lib/csv/bankStatement";

// Shapes modeled on common US bank and card exports
const CHASE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/05/2026,01/06/2026,STARBUCKS STORE 1234,Food & Drink,Sale,-5.25,
01/07/2026,01/08/2026,AMAZON.COM*AB12,Shopping,Sale,-42.10,
01/10/2026,01/10/2026,Payment Thank You,,Payment,500.00,
01/11/2026,01/12/2026,TARGET  00012345,Shopping,Return,12.00,
`;

const AMEX = `Date,Description,Amount
01/05/2026,UBER TRIP,18.40
01/06/2026,ONLINE PAYMENT - THANK YOU,-200.00
01/07/2026,WHOLE FOODS,63.12
`;

const DEBIT_CREDIT = `Date,Details,Debit,Credit,Balance
2026-01-05,"Coffee, Main St",4.50,,995.50
2026-01-06,Paycheck,,1500.00,2495.50
2026-01-07,Groceries,80.00,,2415.50
`;

describe("guessBankMapping", () => {
  it("maps a Chase-style export (purchases negative)", () => {
    const { headers, rows } = parseCsv(CHASE);
    expect(guessBankMapping(headers, rows)).toEqual({
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
      spendingIs: "negative",
      dateFormat: "auto",
    });
  });

  it("maps an Amex-style export (purchases positive)", () => {
    const { headers, rows } = parseCsv(AMEX);
    const mapping = guessBankMapping(headers, rows);
    expect(mapping.amount).toBe("Amount");
    expect(mapping.spendingIs).toBe("positive");
  });

  it("maps separate debit and credit columns", () => {
    const { headers, rows } = parseCsv(DEBIT_CREDIT);
    const mapping = guessBankMapping(headers, rows);
    expect(mapping).toMatchObject({ date: "Date", description: "Details", debit: "Debit", credit: "Credit" });
    expect(mapping.amount).toBeUndefined();
  });
});

describe("validateBankMapping", () => {
  it("explains what's missing", () => {
    const headers = ["Date", "Description", "Amount"];
    expect(validateBankMapping({ date: "", description: "Description", amount: "Amount", spendingIs: "negative", dateFormat: "auto" }, headers)).toMatch(/date/);
    expect(validateBankMapping({ date: "Date", description: "Description", spendingIs: "negative", dateFormat: "auto" }, headers)).toMatch(/amount/);
    expect(validateBankMapping({ date: "Date", description: "Description", amount: "Amount", spendingIs: "negative", dateFormat: "auto" }, headers)).toBeNull();
  });
});

describe("readBankRows", () => {
  it("keeps purchases and skips payments and refunds (negative = spending)", () => {
    const { headers, rows } = parseCsv(CHASE);
    const result = readBankRows(headers, rows, guessBankMapping(headers, rows));
    expect(result[0]).toEqual({ ok: true, date: "2026-01-05", description: "STARBUCKS STORE 1234", spendingCents: 525 });
    expect(result[1]).toMatchObject({ ok: true, spendingCents: 4210 });
    expect(result[2]).toMatchObject({ ok: false, reason: "skip" });
    expect(result[3]).toMatchObject({ ok: false, reason: "skip", description: "TARGET 00012345" });
  });

  it("handles positive = spending", () => {
    const { headers, rows } = parseCsv(AMEX);
    const result = readBankRows(headers, rows, guessBankMapping(headers, rows));
    expect(result.map((r) => (r.ok ? r.spendingCents : r.reason))).toEqual([1840, "skip", 6312]);
  });

  it("handles debit/credit columns", () => {
    const { headers, rows } = parseCsv(DEBIT_CREDIT);
    const result = readBankRows(headers, rows, guessBankMapping(headers, rows));
    expect(result[0]).toEqual({ ok: true, date: "2026-01-05", description: "Coffee, Main St", spendingCents: 450 });
    expect(result[1]).toMatchObject({ ok: false, reason: "skip" });
    expect(result[2]).toMatchObject({ ok: true, spendingCents: 8000 });
  });

  it("reports bad dates and amounts as errors", () => {
    const { headers, rows } = parseCsv("Date,Description,Amount\nnot a date,X,-1.00\n01/02/2026,Y,abc\n01/02/2026,,-1.00\n");
    const result = readBankRows(headers, rows, guessBankMapping(headers, rows));
    expect(result.map((r) => (r.ok ? "ok" : r.reason))).toEqual(["error", "error", "error"]);
  });

  it("detects day-first dates across the file", () => {
    const { headers, rows } = parseCsv("Date,Description,Amount\n05/01/2026,A,-1.00\n25/01/2026,B,-2.00\n");
    const result = readBankRows(headers, rows, guessBankMapping(headers, rows));
    expect(result.map((r) => (r.ok ? r.date : null))).toEqual(["2026-01-05", "2026-01-25"]);
  });
});
