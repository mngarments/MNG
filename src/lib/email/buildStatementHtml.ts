import { inr, safeDate } from "@/lib/format";
import type { PartyStatement } from "@/lib/types";

const NAVY = "#16325b";
const GOLD = "#c4a77c";
const SLATE = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/** Build a clean, email-client-safe HTML billing statement (₹ formatted). */
export function buildStatementHtml(args: BuildStatementArgs): string {
  const {
    statement: s,
    logId,
    appUrl,
    brandName = "MN Garments",
    brandTagline = "Master Apparel Distributor · Ranchi",
    contactEmail,
    contactPhone,
    isReminder = false,
  } = args;

  const pixel = `${appUrl.replace(/\/$/, "")}/api/track/${encodeURIComponent(
    logId
  )}`;

  const invoiceRows = s.invoices
    .map((inv) => {
      const itemLines = inv.items
        .map(
          (it) =>
            `<tr>
              <td style="padding:4px 8px;border-bottom:1px solid ${BORDER};font-size:12px;color:${SLATE}">${esc(
              it.itemName
            )}${it.description ? `<br/><span style="color:${MUTED}">${esc(it.description)}</span>` : ""}</td>
              <td style="padding:4px 8px;border-bottom:1px solid ${BORDER};font-size:12px;text-align:center;color:${SLATE}">${esc(
              it.size
            )}</td>
              <td style="padding:4px 8px;border-bottom:1px solid ${BORDER};font-size:12px;text-align:center;color:${SLATE}">${it.qty}</td>
              <td style="padding:4px 8px;border-bottom:1px solid ${BORDER};font-size:12px;text-align:right;color:${SLATE}">${inr(
              it.rate
            )}</td>
              <td style="padding:4px 8px;border-bottom:1px solid ${BORDER};font-size:12px;text-align:right;color:${SLATE}">${inr(
              it.lineTotal
            )}</td>
            </tr>`
        )
        .join("");

      return `
      <div style="margin:0 0 16px">
        <div style="background:#f8fafc;border:1px solid ${BORDER};border-bottom:none;border-radius:8px 8px 0 0;padding:8px 12px;display:flex;justify-content:space-between">
          <span style="font-size:13px;font-weight:600;color:${NAVY}">Invoice ${esc(
        inv.docNo
      )}</span>
          <span style="font-size:12px;color:${MUTED}">${esc(safeDate(inv.docDate))} · ${
        inv.pieces
      } pcs</span>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${BORDER};border-radius:0 0 8px 8px;overflow:hidden">
          <thead>
            <tr style="background:#f1f5f9">
              <th align="left"   style="padding:6px 8px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">Item</th>
              <th align="center" style="padding:6px 8px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">Size</th>
              <th align="center" style="padding:6px 8px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">Qty</th>
              <th align="right"  style="padding:6px 8px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">Rate</th>
              <th align="right"  style="padding:6px 8px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">Amount</th>
            </tr>
          </thead>
          <tbody>${itemLines}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:6px 8px;text-align:right;font-size:12px;color:${MUTED}">Invoice total</td>
              <td style="padding:6px 8px;text-align:right;font-size:13px;font-weight:600;color:${NAVY}">${inr(
        inv.total
      )}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    })
    .join("");

  const contactBits = [
    contactPhone ? `Ph: ${esc(contactPhone)}` : "",
    contactEmail ? `Email: ${esc(contactEmail)}` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const reminderBanner = isReminder
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:10px 14px;font-size:13px;margin:0 0 18px">
         <strong>Gentle reminder</strong> — sharing your statement again for your records.
       </div>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Statement · ${esc(brandName)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER}">
      <tr>
        <td style="background:${NAVY};padding:22px 24px">
          <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.02em">
            M<span style="color:${GOLD}">N</span> ${esc(brandName.replace(/^MN\s*/i, ""))}
          </div>
          <div style="font-size:12px;color:#c7d2e0;margin-top:2px">${esc(
            brandTagline
          )}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px">
          ${reminderBanner}
          <div style="font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Billing Statement</div>
          <div style="font-size:20px;font-weight:700;color:${SLATE}">${esc(
    s.partyName
  )}</div>
          <div style="font-size:12px;color:${MUTED};margin-top:4px">
            Party Code: ${esc(s.partyCode)}${
    s.gstin ? ` &nbsp;·&nbsp; GSTIN: ${esc(s.gstin)}` : ""
  }${s.beat ? ` &nbsp;·&nbsp; Beat: ${esc(s.beat)}` : ""}
          </div>

          <!-- Totals -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:separate;border-spacing:8px 0">
            <tr>
              ${totalCell("Invoices", String(s.invoiceCount))}
              ${totalCell("Total Pieces", String(s.totalPieces))}
              ${totalCell("Taxable Value", inr(s.taxableValue))}
              ${totalCell("GST", inr(s.gst))}
            </tr>
          </table>

          <div style="background:${NAVY};border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
            <span style="font-size:13px;color:#c7d2e0;text-transform:uppercase;letter-spacing:.06em">Grand Total</span>
            <span style="font-size:22px;font-weight:700;color:#ffffff">${inr(
              s.grandTotal
            )}</span>
          </div>

          <div style="font-size:13px;font-weight:600;color:${NAVY};margin:0 0 12px">Invoice Breakdown</div>
          ${invoiceRows}

          <p style="font-size:12px;color:${MUTED};line-height:1.6;margin-top:18px">
            This statement is a summary of your recent purchases from ${esc(
              brandName
            )}. Amounts are inclusive of applicable GST. For any query on invoices or payments, please reach out to our sales desk.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;border-top:1px solid ${BORDER};padding:16px 24px;text-align:center">
          <div style="font-size:12px;color:${MUTED}">${esc(brandName)} · ${esc(
    brandTagline
  )}</div>
          ${
            contactBits
              ? `<div style="font-size:12px;color:${MUTED};margin-top:4px">${contactBits}</div>`
              : ""
          }
        </td>
      </tr>
    </table>
  </div>
  <img src="${pixel}" width="1" height="1" alt="" style="display:none" />
</body>
</html>`;
}

function totalCell(label: string, value: string): string {
  return `<td width="25%" style="background:#f8fafc;border:1px solid ${BORDER};border-radius:8px;padding:10px 12px;text-align:center">
    <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">${label}</div>
    <div style="font-size:15px;font-weight:700;color:${SLATE};margin-top:3px">${value}</div>
  </td>`;
}
