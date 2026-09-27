import { num } from "@/lib/format";
import type {
  InvoiceSummary,
  LineItem,
  PartyStatement,
} from "@/lib/types";
import type { SalesRow } from "./parseSalesReport";

/**
 * Group the untouched parsed rows by `Party Code` (same key logic as
 * `aggregateByParty`). Returns the original row objects unchanged — every
 * original CSV column is preserved — so a party's exact rows can be exported
 * to Excel and attached to that party's statement email.
 */
export function groupRowsByParty(
  rows: SalesRow[]
): Record<string, SalesRow[]> {
  const byParty: Record<string, SalesRow[]> = {};
  for (const row of rows) {
    const partyCode = (row["Party Code"] || "").trim();
    if (!partyCode) continue;
    (byParty[partyCode] ??= []).push(row);
  }
  return byParty;
}

/**
 * Group parsed sales rows strictly by `Party Code` into per-party statements.
 * GST is summed across CGST + SGST + IGST so both intra- and inter-state
 * parties aggregate correctly.
 */
export function aggregateByParty(rows: SalesRow[]): PartyStatement[] {
  const parties = new Map<string, PartyStatement>();
  // party -> docNo -> invoice
  const invoiceIndex = new Map<string, Map<string, InvoiceSummary>>();

  for (const row of rows) {
    const partyCode = (row["Party Code"] || "").trim();
    if (!partyCode) continue;

    let party = parties.get(partyCode);
    if (!party) {
      party = {
        partyCode,
        partyName: (row["Party Name"] || "").trim(),
        gstin: (row["Party GSTIN"] || "").trim(),
        beat: (row["Party Beat Name"] || "").trim(),
        state: (row["State"] || "").trim(),
        invoiceCount: 0,
        totalPieces: 0,
        taxableValue: 0,
        gst: 0,
        grandTotal: 0,
        invoices: [],
      };
      parties.set(partyCode, party);
      invoiceIndex.set(partyCode, new Map());
    }

    const qty = num(row["Qty"]);
    const taxable = num(row["Taxable Value"]);
    const gst =
      num(row["CGST Amount"]) + num(row["SGST Amount"]) + num(row["IGST Amount"]);
    const total = num(row["Total Amt"]);

    party.totalPieces += qty;
    party.taxableValue += taxable;
    party.gst += gst;
    party.grandTotal += total;

    const docNo = (row["Doc No"] || "").trim() || "—";
    const invoices = invoiceIndex.get(partyCode)!;
    let invoice = invoices.get(docNo);
    if (!invoice) {
      invoice = {
        docNo,
        docDate: (row["Doc Date"] || "").trim(),
        items: [],
        pieces: 0,
        taxable: 0,
        gst: 0,
        total: 0,
      };
      invoices.set(docNo, invoice);
      party.invoices.push(invoice);
    }

    const item: LineItem = {
      itemName: (row["Item Name"] || "").trim(),
      description: (row["Product Description"] || "").trim(),
      size: (row["Size"] || "").trim(),
      qty,
      rate: num(row["Rate"]),
      mrp: num(row["MRP"]),
      lineTotal: total,
    };
    invoice.items.push(item);
    invoice.pieces += qty;
    invoice.taxable += taxable;
    invoice.gst += gst;
    invoice.total += total;
  }

  const statements = Array.from(parties.values());
  for (const p of statements) {
    p.invoiceCount = p.invoices.length;
    // Round accumulated floats to 2dp to avoid FP drift in display/emails.
    p.taxableValue = round2(p.taxableValue);
    p.gst = round2(p.gst);
    p.grandTotal = round2(p.grandTotal);
    for (const inv of p.invoices) {
      inv.taxable = round2(inv.taxable);
      inv.gst = round2(inv.gst);
      inv.total = round2(inv.total);
    }
  }

  // Highest-value parties first.
  statements.sort((a, b) => b.grandTotal - a.grandTotal);
  return statements;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
