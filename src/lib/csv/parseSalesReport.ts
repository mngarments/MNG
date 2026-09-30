import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Thrown when the uploaded CSV is missing required columns. */
export class CsvSchemaError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(
      `The uploaded file is missing required column(s): ${missing.join(", ")}. ` +
        `Please upload the distributor "Sales Report - Detailed" export.`
    );
    this.name = "CsvSchemaError";
    this.missing = missing;
  }
}

/**
 * Thrown when long numeric codes were mangled into scientific notation
 * (e.g. "8.90561E+12") — which happens when the CSV is opened and re-saved in
 * Excel. The original digits are unrecoverable, so the file must be rejected.
 */
export class CorruptedCodesError extends Error {
  count: number;
  constructor(count: number, sample: string) {
    super(
      `${count} row(s) have codes like ${sample} — this file was re-saved in ` +
        `Excel, which destroys the digits. Please upload the original export ` +
        `from the portal (don't open/save it in Excel first), or upload the .xlsx.`
    );
    this.name = "CorruptedCodesError";
    this.count = count;
  }
}

/** Long numeric identifiers that must always be kept as exact text. */
export const CODE_COLUMNS = [
  "Batch Code",
  "HSN",
  "Item Code",
  "Channel Code",
] as const;

const SCI_NOTATION = /^\d+(\.\d+)?E\+\d+$/i;

export type SalesRow = Record<string, string>;

// Columns the aggregation relies on. Validated up-front.
export const REQUIRED_COLUMNS = [
  "Doc No",
  "Doc Date",
  "Party Code",
  "Party Name",
  "Party GSTIN",
  "Party Beat Name",
  "State",
  "Item Name",
  "Product Description",
  "Size",
  "Qty",
  "Rate",
  "MRP",
  "Taxable Value",
  "CGST Amount",
  "SGST Amount",
  "IGST Amount",
  "Total Amt",
] as const;

export interface ParseResult {
  rows: SalesRow[];
  fields: string[];
}

/**
 * Parse the raw CSV text into rows, validating the schema.
 * Throws CsvSchemaError if required columns are absent.
 */
export function parseSalesReport(csvText: string): ParseResult {
  const parsed = Papa.parse<SalesRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  return finalize(parsed.data as SalesRow[], parsed.meta.fields ?? []);
}

/**
 * Parse an .xlsx/.xls sales report. Cells are read raw and stringified so long
 * codes (EAN batch codes) keep every digit instead of Excel's display format.
 */
export function parseSalesReportXlsx(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new CsvSchemaError([...REQUIRED_COLUMNS]);

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: "",
  });
  const [headerRow] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: 0,
  });
  const rawFields = (headerRow ?? []).map((h) => String(h ?? ""));

  const rows: SalesRow[] = records.map((rec) => {
    const out: SalesRow = {};
    for (const [k, v] of Object.entries(rec)) out[k.trim()] = cellToString(v);
    return out;
  });

  return finalize(rows, rawFields);
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${v.getFullYear()}`;
  }
  return String(v);
}

/** Shared validation for CSV and Excel uploads. */
function finalize(data: SalesRow[], rawFields: string[]): ParseResult {
  const fields = rawFields.map((f) => f.trim()).filter(Boolean);
  if (fields.length === 0) {
    throw new CsvSchemaError([...REQUIRED_COLUMNS]);
  }

  const fieldSet = new Set(fields);
  const missing = REQUIRED_COLUMNS.filter((c) => !fieldSet.has(c));
  if (missing.length > 0) {
    throw new CsvSchemaError(missing);
  }

  // Drop fully-empty rows (no Party Code and no Doc No).
  const rows = data.filter(
    (r) => (r["Party Code"] || "").trim() || (r["Doc No"] || "").trim()
  );

  // Reject files whose codes were mangled into scientific notation.
  let corrupted = 0;
  let sample = "";
  for (const r of rows) {
    const bad = CODE_COLUMNS.map((c) => (r[c] || "").trim()).find((v) =>
      SCI_NOTATION.test(v)
    );
    if (bad) {
      corrupted++;
      sample ||= bad;
    }
  }
  if (corrupted > 0) throw new CorruptedCodesError(corrupted, sample);

  return { rows, fields };
}
