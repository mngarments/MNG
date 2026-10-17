// Talks to TallyPrime's local XML server and turns its responses into the
// rows MNG stores. Read-only: only Export requests are ever sent.
//
// Field names follow TallyPrime's documented XML schema. Tally signs amounts
// as −Dr / +Cr; everything returned from here is flipped to +Dr / −Cr (a
// positive party balance = the party owes us), matching the MNG database.

import { childText, children, findAll, parseXml } from "./xml.mjs";

export class TallyError extends Error {
  constructor(message) {
    super(message);
    this.name = "TallyError";
  }
}

export function createTally(tallyUrl, { timeoutMs = 300_000 } = {}) {
  /** POST an XML envelope and return the parsed response tree. */
  async function request(body) {
    let res;
    try {
      res = await fetch(tallyUrl, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new TallyError(
        `Could not reach Tally at ${tallyUrl} (${err.cause?.code || err.message}). ` +
          "Is TallyPrime running with a company open, and is F1 Help > Settings > " +
          "Connectivity set to 'TallyPrime acts as: Server' on port 9000?"
      );
    }
    const text = decode(new Uint8Array(await res.arrayBuffer()));
    const lineError = text.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/)?.[1];
    if (lineError) throw new TallyError(`Tally rejected the request: ${lineError.trim()}`);
    if (!res.ok) throw new TallyError(`Tally returned HTTP ${res.status}`);
    return parseXml(text);
  }

  return {
    /** Companies currently open in Tally. */
    async companies() {
      const tree = await request(
        collection("MNGCompanies", "Company", "Name, GUID, BooksFrom, StartingFrom")
      );
      return findAll(tree, "COMPANY").map((c) => ({
        name: c.attrs.NAME || childText(c, "NAME"),
        guid: childText(c, "GUID"),
        booksFrom: tallyDate(childText(c, "BOOKSFROM")) || tallyDate(childText(c, "STARTINGFROM")),
      }));
    },

    /** Every ledger under Sundry Debtors (including subgroups). */
    async debtorLedgers(company, asOf) {
      const tree = await request(
        collection(
          "MNGDebtors",
          "Ledger",
          "GUID, AlterID, Name, Parent, OpeningBalance, ClosingBalance, " +
            "LedgerMobile, LedgerPhone, Email, PartyGSTIN, LedGSTRegDetails.GSTIN, " +
            "BillCreditPeriod, BillAllocations.Name, BillAllocations.BillDate, " +
            "BillAllocations.OpeningBalance, BillAllocations.BillCreditPeriod",
          { SVCURRENTCOMPANY: company, SVTODATE: asOf },
          "<CHILDOF>$$GroupSundryDebtors</CHILDOF><BELONGSTO>Yes</BELONGSTO>"
        )
      );
      return findAll(tree, "LEDGER").map(normalizeLedger).filter((l) => l.guid && l.name);
    },

    /**
     * Vouchers dated within [from, to], optionally only those with
     * AlterID > afterAlterId. Returns raw voucher nodes; use normalizeVoucher.
     */
    async vouchers(company, from, to, afterAlterId = null) {
      const filters = ["MNGInRange"];
      let formulae =
        `<SYSTEM TYPE="Formulae" NAME="MNGInRange">$Date >= ##SVFromDate AND $Date <= ##SVToDate</SYSTEM>`;
      if (afterAlterId != null) {
        filters.push("MNGChanged");
        formulae += `<SYSTEM TYPE="Formulae" NAME="MNGChanged">$AlterID > ${Number(afterAlterId)}</SYSTEM>`;
      }
      const entryFields = (list) =>
        `${list}.LedgerName, ${list}.Amount, ${list}.BillAllocations.Name, ` +
        `${list}.BillAllocations.BillType, ${list}.BillAllocations.Amount, ` +
        `${list}.BillAllocations.BillCreditPeriod`;
      const tree = await request(
        collection(
          "MNGVouchers",
          "Voucher",
          "GUID, AlterID, Date, VoucherNumber, VoucherTypeName, Narration, Reference, " +
            "IsCancelled, IsOptional, PartyLedgerName, " +
            entryFields("AllLedgerEntries") + ", " + entryFields("LedgerEntries"),
          { SVCURRENTCOMPANY: company, SVFROMDATE: toTally(from), SVTODATE: toTally(to) },
          filters.map((f) => `<FILTER>${f}</FILTER>`).join(""),
          formulae
        )
      );
      return findAll(tree, "VOUCHER");
    },
  };
}

// --- Request building -----------------------------------------------------------

function collection(name, type, fetch, vars = {}, extraTags = "", formulae = "") {
  const statics = { SVEXPORTFORMAT: "$$SysName:XML", ...vars };
  const staticXml = Object.entries(statics)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
    .join("");
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES>${staticXml}</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="${name}" ISMODIFY="No"><TYPE>${type}</TYPE>${extraTags}<FETCH>${fetch}</FETCH></COLLECTION>
${formulae}
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>`;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tally answers in UTF-16LE (with or without a BOM) or UTF-8. */
function decode(bytes) {
  const utf16 =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes.length > 1 && bytes[0] !== 0 && bytes[1] === 0);
  return new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(bytes).replace(/^﻿/, "");
}

// --- Normalization ----------------------------------------------------------------

export function normalizeLedger(node) {
  const gstin =
    childText(node, "PARTYGSTIN") ||
    findAll(node, "LEDGSTREGDETAILS.LIST").map((d) => childText(d, "GSTIN")).find(Boolean) ||
    "";
  const credit = creditPeriod(node, "BILLCREDITPERIOD");
  const openingBills = children(node, "BILLALLOCATIONS.LIST")
    .map((b) => {
      const name = childText(b, "NAME");
      const amount = drAmount(childText(b, "OPENINGBALANCE"));
      if (!name || amount === 0) return null;
      const billDate = tallyDate(childText(b, "BILLDATE"));
      return {
        bill_name: name,
        bill_date: billDate,
        due_date: dueDate(billDate, creditPeriod(b, "BILLCREDITPERIOD")),
        amount,
      };
    })
    .filter(Boolean);

  return {
    guid: childText(node, "GUID"),
    name: node.attrs.NAME || childText(node, "NAME"),
    parent_group: childText(node, "PARENT") || null,
    opening_balance: drAmount(childText(node, "OPENINGBALANCE")),
    closing_balance: drAmount(childText(node, "CLOSINGBALANCE")),
    credit_period_days: credit?.days ?? null,
    phone: childText(node, "LEDGERMOBILE") || childText(node, "LEDGERPHONE") || null,
    email: childText(node, "EMAIL") || null,
    gstin: gstin || null,
    alter_id: int(childText(node, "ALTERID")),
    opening_bills: openingBills,
  };
}

/**
 * Keep only the debtor side of a voucher. `ledgerGuids` maps ledger name →
 * GUID for the debtor ledgers. Returns null when the voucher has no debtor
 * line, unless `keepEmpty` (incremental syncs use it so a voucher edited to no
 * longer involve a debtor has its old lines cleared).
 */
export function normalizeVoucher(node, ledgerGuids, { keepEmpty = false } = {}) {
  const date = tallyDate(childText(node, "DATE"));
  const all = children(node, "ALLLEDGERENTRIES.LIST");
  // Invoice-mode vouchers may only list ledgers under LEDGERENTRIES.LIST; never use both.
  const entries = all.some((e) => childText(e, "LEDGERNAME"))
    ? all
    : children(node, "LEDGERENTRIES.LIST");

  const lines = new Map();
  const bills = new Map();
  for (const e of entries) {
    const ledgerGuid = lookup(ledgerGuids, childText(e, "LEDGERNAME"));
    if (!ledgerGuid) continue;
    lines.set(ledgerGuid, (lines.get(ledgerGuid) ?? 0) + drAmount(childText(e, "AMOUNT")));

    for (const b of children(e, "BILLALLOCATIONS.LIST")) {
      const type = childText(b, "BILLTYPE") || null;
      const rawAmount = childText(b, "AMOUNT");
      const name = childText(b, "NAME") || (type === "On Account" ? "(On Account)" : "");
      if (!name || !rawAmount) continue; // Tally emits empty placeholder lists
      const key = `${ledgerGuid}\u0000${name}`;
      const prev = bills.get(key);
      const amount = drAmount(rawAmount);
      if (prev) {
        prev.amount += amount;
      } else {
        bills.set(key, {
          ledger_guid: ledgerGuid,
          bill_name: name,
          bill_type: type,
          amount,
          due_date: dueDate(date, creditPeriod(b, "BILLCREDITPERIOD")),
        });
      }
    }
  }
  if (lines.size === 0 && !keepEmpty) return null;

  return {
    guid: childText(node, "GUID") || node.attrs.REMOTEID,
    alter_id: int(childText(node, "ALTERID")),
    date,
    voucher_number: childText(node, "VOUCHERNUMBER") || null,
    voucher_type: childText(node, "VOUCHERTYPENAME") || node.attrs.VCHTYPE || null,
    narration: childText(node, "NARRATION") || null,
    reference: childText(node, "REFERENCE") || null,
    is_cancelled: yes(childText(node, "ISCANCELLED")),
    is_optional: yes(childText(node, "ISOPTIONAL")),
    lines: [...lines].map(([ledger_guid, amount]) => ({ ledger_guid, amount: round2(amount) })),
    bills: [...bills.values()].map((b) => ({ ...b, amount: round2(b.amount) })),
  };
}

function lookup(map, name) {
  if (!name) return null;
  return map.get(name) ?? map.get(name.toLowerCase()) ?? null;
}

// --- Value parsing ----------------------------------------------------------------

/** Tally amount text → number in +Dr / −Cr convention. */
export function drAmount(text) {
  if (!text) return 0;
  const s = text.replace(/,/g, "");
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  let n = parseFloat(m[0]);
  // Rare report-style values carry an explicit Dr/Cr suffix instead of a sign.
  if (/\bDr\b/i.test(s)) n = -Math.abs(n);
  else if (/\bCr\b/i.test(s)) n = Math.abs(n);
  return round2(-n);
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "20260401" or "1-Apr-2026" / "1-Apr-26" → "2026-04-01" (null if unparseable). */
export function tallyDate(text) {
  if (!text) return null;
  const s = text.trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{2,4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${year}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(Number(m[1]))}`;
  }
  return null;
}

/** "2026-04-01" → "20260401" for SVFROMDATE/SVTODATE. */
export function toTally(iso) {
  return iso.replaceAll("-", "");
}

/** BILLCREDITPERIOD is either "30 Days" or an explicit due date. */
function creditPeriod(node, field) {
  const el = node.children.find((c) => c.name === field);
  if (!el) return null;
  const text = el.attrs.P || el.text.trim();
  const days = text.match(/^(\d+)\s*Days?$/i);
  if (days) return { days: Number(days[1]) };
  const date = tallyDate(text);
  return date ? { date } : null;
}

function dueDate(billDate, credit) {
  if (credit?.date) return credit.date;
  if (credit?.days != null && billDate) return addDays(billDate, credit.days);
  return null;
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function int(text) {
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : null;
}

function yes(text) {
  return /^yes$/i.test(text);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function pad(n) {
  return String(n).padStart(2, "0");
}
