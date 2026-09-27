import Papa from "papaparse";

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

  const fields = (parsed.meta.fields ?? []).map((f) => f.trim());
  if (fields.length === 0) {
    throw new CsvSchemaError([...REQUIRED_COLUMNS]);
  }

  const fieldSet = new Set(fields);
  const missing = REQUIRED_COLUMNS.filter((c) => !fieldSet.has(c));
  if (missing.length > 0) {
    throw new CsvSchemaError(missing);
  }

  // Drop fully-empty rows (no Party Code and no Doc No).
  const rows = (parsed.data as SalesRow[]).filter(
    (r) => (r["Party Code"] || "").trim() || (r["Doc No"] || "").trim()
  );

  return { rows, fields };
}
