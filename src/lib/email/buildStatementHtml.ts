import type { PartyStatement } from "@/lib/types";

const NAVY = "#16325b";
const GOLD = "#c4a77c";
const MUTED = "#64748b";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Comma-separated list of the party's invoice (Doc No) numbers, in file order.
 * Placeholder "—" (no doc number) entries are dropped. Used in both the email
 * subject and body so they always match.
 */
export function invoiceNumbersOf(s: PartyStatement): string {
  return s.invoices
    .map((inv) => (inv.docNo || "").trim())
    .filter((d) => d && d !== "—")
    .join(", ");
}

export interface BuildStatementArgs {
  statement: PartyStatement;
  logId: string;
  appUrl: string;
  brandName?: string;
  brandTagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  isReminder?: boolean;
}

/**
 * Build the PT-file email body. The Excel attachment carries the detail; the
 * body is intentionally just a short greeting referencing the invoice number(s).
 * A hidden 1×1 pixel preserves open-tracking for the Delivery dashboard.
 */
export function buildStatementHtml(args: BuildStatementArgs): string {
  const {
    statement: s,
    logId,
    appUrl,
    brandName = "MN Garments",
    isReminder = false,
  } = args;

  const pixel = `${appUrl.replace(/\/$/, "")}/api/track/${encodeURIComponent(
    logId
  )}`;

  const docNos = invoiceNumbersOf(s);
  const docLabel = docNos || s.partyCode;

  const reminderLine = isReminder
    ? `<p style="margin:0 0 14px;font-size:14px;color:${MUTED}">Gentle reminder — sharing the PT file again for your records.</p>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PT File Invoice No:${esc(docLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <div style="font-size:20px;font-weight:700;color:${NAVY};margin:0 0 18px">
      M<span style="color:${GOLD}">N</span> ${esc(brandName.replace(/^MN\s*/i, ""))}
    </div>
    ${reminderLine}
    <p style="margin:0 0 14px;font-size:15px;color:#0f172a">Greetings,</p>
    <p style="margin:0;font-size:15px;color:#0f172a;line-height:1.6">
      Please find the attached PT file for your invoice number ${esc(docLabel)}.
    </p>
  </div>
  <img src="${pixel}" width="1" height="1" alt="" style="display:none" />
</body>
</html>`;
}
