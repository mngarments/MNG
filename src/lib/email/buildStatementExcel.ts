import * as XLSX from "xlsx";
import { CODE_COLUMNS, type SalesRow } from "@/lib/csv/parseSalesReport";

export interface BuildExcelArgs {
  rows: SalesRow[];
  fields: string[];
  partyName: string;
  partyCode: string;
}

export interface StatementAttachment {
  filename: string;
  content: Buffer;
}

function sanitize(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|]+/g, " ") // illegal filename chars
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "customer"
  );
}

/**
 * Build a single-sheet .xlsx of one party's EXACT rows, preserving the original
 * CSV column order via `fields`. Returns a filename + buffer ready to attach.
 */
export function buildStatementExcel({
  rows,
  fields,
  partyName,
  partyCode,
}: BuildExcelArgs): StatementAttachment {
  // Preserve the original column order; json_to_sheet fills blanks for any
  // header missing on a given row.
  const header = fields && fields.length ? fields : Object.keys(rows[0] ?? {});
  const sheet = XLSX.utils.json_to_sheet(rows, { header });

  // Force code columns to Text so Excel never shows them as 8.9E+12.
  CODE_COLUMNS.forEach((name) => {
    const c = header.indexOf(name);
    if (c < 0) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.t = "s";
      cell.v = String(cell.v ?? "");
      cell.z = "@";
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Statement");

  const content = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  const filename = `MN-Garments-${sanitize(partyName)}-${sanitize(
    partyCode
  )}.xlsx`;

  return { filename, content };
}
