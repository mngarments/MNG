import Papa from "papaparse";
import * as XLSX from "xlsx";

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

function mapRow(raw: Record<string, unknown>): CustomerImportRow | null {
  const out: Partial<CustomerImportRow> = {};
  for (const [key, val] of Object.entries(raw)) {
    const field = FIELD_ALIASES[normalizeKey(key)];
    if (!field) continue;
    const v = val == null ? "" : String(val).trim();
    if (v) out[field] = v;
  }
  if (!out.party_code) return null;
  return out as CustomerImportRow;
}

/**
 * Parse an uploaded customer-directory file (CSV or Excel) into normalized rows.
 * De-duplicates by party_code (last occurrence wins) so a single upload is
 * internally consistent; the DB upsert then makes re-uploads idempotent.
 */
export function parseCustomerImport(
  buffer: Buffer,
  filename: string
): CustomerImportRow[] {
  const lower = filename.toLowerCase();
  let records: Record<string, unknown>[] = [];

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
  } else {
    const text = buffer.toString("utf8");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    records = parsed.data;
  }

  const byCode = new Map<string, CustomerImportRow>();
  for (const raw of records) {
    const mapped = mapRow(raw);
    if (!mapped) continue;
    const existing = byCode.get(mapped.party_code);
    byCode.set(mapped.party_code, { ...existing, ...mapped });
  }
  return Array.from(byCode.values());
}
