/**
 * Minimal RFC 4180 CSV reading and writing (quoted fields, escaped quotes, newlines inside
 * quotes, CRLF or LF). Reading also strips a UTF-8 BOM and detects comma, semicolon or tab.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

const DELIMITERS = [",", ";", "\t"] as const;

/** Picks the delimiter that appears most often (outside quotes) in the first line */
export function detectDelimiter(text: string): string {
  const firstLine: string[] = [];
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    firstLine.push(ch);
  }

  let best: string = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = firstLine.filter((c) => c === d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(text);

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      // Quotes only open a quoted field at its start; elsewhere they're literal characters
      inQuotes = true;
    } else if (ch === delim) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  // Drop blank lines (a single empty field)
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0]!.trim() === ""));
  const [headerRow = [], ...rows] = nonEmpty;
  return {
    headers: headerRow.map((h) => h.trim()),
    rows,
    delimiter: delim,
  };
}

/** Turns a parsed row into { header: value }, ignoring extra cells and filling missing ones with "" */
export function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((h, i) => {
    record[h] = (row[i] ?? "").trim();
  });
  return record;
}

/**
 * Spreadsheet apps treat cells starting with these characters as formulas, so text fields are
 * prefixed with an apostrophe on export (and the apostrophe is removed again on import).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function guardFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function unguardFormula(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Builds a CSV document (CRLF line endings, with a BOM so Excel reads it as UTF-8) */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string>>): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeField).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
