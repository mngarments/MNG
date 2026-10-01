import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isValidEmail, joinEmails, splitEmails } from "@/lib/emails";

export interface CustomerImportRow {
  party_code: string;
  party_name?: string;
  email?: string;
  phone?: string;
  gstin?: string;
}

// Header aliases → canonical field. Matched case-insensitively, ignoring
// spaces/underscores, so real-world exports "just work".
const FIELD_ALIASES: Record<string, keyof CustomerImportRow> = {
  partycode: "party_code",
  code: "party_code",
  party: "party_code",
  partyname: "party_name",
  name: "party_name",
  customer: "party_name",
  email: "email",
  emailid: "email",
  emailaddress: "email",
  mail: "email",
  phone: "phone",
  mobile: "phone",
  contact: "phone",
  phoneno: "phone",
  gstin: "gstin",
  gst: "gstin",
};

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_./-]/g, "");
}

// "Email 2", "Alternate Email", "Email ID1", "Mail2"… → extra email columns.
function isEmailHeader(norm: string): boolean {
  return /e?mail/.test(norm);
}

// SheetJS names blank header cells "__EMPTY", "__EMPTY_1"…
function isBlankHeader(key: string): boolean {
  return !key.trim() || /^__EMPTY(_\d+)?$/.test(key);
}

function looksLikeEmails(v: string): boolean {
  const list = splitEmails(v);
  return list.length > 0 && list.every(isValidEmail);
}

export interface CustomerImportResult {
  rows: CustomerImportRow[];
  /** Human-readable notes about how the file's columns were interpreted. */
  notes: string[];
  /** Columns that were neither recognised nor auto-detected. */
  ignoredColumns: string[];
}

/**
 * Parse an uploaded customer-directory file (CSV or Excel) into normalized rows.
 * De-duplicates by party_code (last occurrence wins) so a single upload is
 * internally consistent; the DB upsert then makes re-uploads idempotent.
 *
 * Emails are collected from every email-like column (Email, Email 2, Alt
 * Email…), plus any column without a recognised header whose values are
 * email addresses — so a forgotten "Email" header doesn't silently drop them.
 */
export function parseCustomerImport(
  buffer: Buffer,
  filename: string
): CustomerImportResult {
  const lower = filename.toLowerCase();
  let records: Record<string, unknown>[] = [];

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // raw: false → the cell's displayed text, so a code shown as "00123"
    // keeps its leading zeros and never becomes 123 or 1.23E+4.
    records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
  } else {
    const text = buffer.toString("utf8");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h, i) => h.trim() || `__EMPTY_${i}`,
    });
    records = parsed.data;
  }

  const str = (v: unknown) =>
    v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();

  // Classify each column once.
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const fieldOf = new Map<string, keyof CustomerImportRow>();
  const emailCols: string[] = [];
  const notes: string[] = [];
  const ignoredColumns: string[] = [];

  keys.forEach((key) => {
    const norm = normalizeKey(key);
    const alias = FIELD_ALIASES[norm];
    if (alias === "email" || (!alias && isEmailHeader(norm))) {
      emailCols.push(key);
      return;
    }
    if (alias) {
      fieldOf.set(key, alias);
      return;
    }
    // Unrecognised / unlabeled column: adopt it as email if its values are.
    const values = records.map((r) => str(r[key])).filter(Boolean);
    const emailish = values.filter(looksLikeEmails).length;
    const label = isBlankHeader(key) ? "A column with no header" : `Column “${key}”`;
    if (values.length > 0 && emailish / values.length >= 0.6) {
      emailCols.push(key);
      notes.push(
        `${label} contains email addresses — imported as Email. Label it “Email” to be safe.`
      );
    } else if (values.length > 0) {
      ignoredColumns.push(isBlankHeader(key) ? "(unlabeled column)" : key);
    }
  });

  const byCode = new Map<string, CustomerImportRow>();
  for (const raw of records) {
    const out: Partial<CustomerImportRow> = {};
    for (const [key, field] of fieldOf) {
      const v = str(raw[key]);
      if (v) out[field] = v;
    }
    const emails = emailCols.flatMap((k) =>
      splitEmails(str(raw[k])).filter(isValidEmail)
    );
    const email = joinEmails(emails);
    if (email) out.email = email;
    if (!out.party_code) continue;

    const existing = byCode.get(out.party_code);
    byCode.set(out.party_code, { ...existing, ...(out as CustomerImportRow) });
  }
  return { rows: Array.from(byCode.values()), notes, ignoredColumns };
}

/**
 * Loose key for matching a party code from an uploaded sheet to the one
 * stored in the DB: case, spaces/punctuation and leading zeros are ignored,
 * so "mn-0042 ", "MN0042" and "MN42" all match the same party.
 */
export function partyCodeKey(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+(?=\d)/, "")
    .replace(/([A-Z])0+(?=\d)/g, "$1");
}
