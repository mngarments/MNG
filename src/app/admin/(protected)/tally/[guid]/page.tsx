"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LoadError, { describeFailure } from "@/components/admin/LoadError";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
import { inr, drCr, safeDate } from "@/lib/format";
import type { TallyBill, TallyLedgerEntry, TallyParty } from "@/lib/types";

interface Detail {
  party: TallyParty;
  openingBalance: number;
  bills: TallyBill[];
  entries: TallyLedgerEntry[];
}

/** Start of the current Indian financial year (1 April), as YYYY-MM-DD. */
function fyStart(): string {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function TallyPartyPage() {
  const { guid } = useParams<{ guid: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(todayIso);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tally/parties/${encodeURIComponent(guid)}`);
        const failure = res.ok ? null : await describeFailure(res);
        const json = res.ok ? await res.json() : null;
        if (cancelled) return;
        setDetail(json);
        setLoadError(failure);
      } catch (err) {
        if (!cancelled) setLoadError(await describeFailure(null, err));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [guid]);

  // Ledger for [from, to] with an opening balance brought forward and a running balance.
  const ledger = useMemo(() => {
    if (!detail) return null;
    let opening = detail.openingBalance;
    const rows: (TallyLedgerEntry & { balance: number })[] = [];
    let balance = 0;
    let debit = 0;
    let credit = 0;
    for (const e of detail.entries) {
      if (e.date < from) {
        opening += e.amount;
        continue;
      }
      if (e.date > to) break;
      if (rows.length === 0) balance = opening;
      balance += e.amount;
      if (e.amount > 0) debit += e.amount;
      else credit -= e.amount;
      rows.push({ ...e, balance });
    }
    return { opening, rows, debit, credit, closing: rows.length ? balance : opening };
  }, [detail, from, to]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  const p = detail?.party;
  const openBills = detail?.bills.filter((b) => b.pending_amount > 0) ?? [];
  const credits = detail?.bills.filter((b) => b.pending_amount < 0) ?? [];
  const mismatch =
    p && p.closing_balance != null && Math.abs(p.closing_balance - p.computed_balance) > 1;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <Link
        href="/admin/tally"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-slate"
      >
        <ArrowLeft className="w-4 h-4" /> All parties
      </Link>

      <LoadError message={loadError} />

      {p && ledger && (
        <>
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-brand-slate">{p.name}</h1>
            <p className="text-sm text-slate-500">
              {[
                p.parent_group,
                p.gstin && `GSTIN ${p.gstin}`,
                p.phone,
                p.email,
                p.credit_period_days != null && `${p.credit_period_days} days credit`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          {mismatch && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 w-4 h-4 shrink-0" />
              <div>
                Tally shows a closing balance of <strong>{drCr(p.closing_balance)}</strong>, but the
                synced vouchers add up to <strong>{drCr(p.computed_balance)}</strong>. Some entries
                may be missing or misread; a full sync (<code>node agent.mjs sync --full</code>)
                usually fixes it.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
            <Tile label="Balance" value={drCr(p.computed_balance)} strong />
            <Tile label="Not yet due" value={inr(p.not_due, false)} />
            <Tile label="1–30 days" value={inr(p.age_1_30, false)} warn={p.age_1_30 > 0} />
            <Tile label="31–60 days" value={inr(p.age_31_60, false)} warn={p.age_31_60 > 0} />
            <Tile label="61–90 days" value={inr(p.age_61_90, false)} warn={p.age_61_90 > 0} />
            <Tile label="90+ days" value={inr(p.age_90_plus, false)} warn={p.age_90_plus > 0} />
          </div>

          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-brand-slate">
              Open bills ({openBills.length})
            </h2>
            {openBills.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                No pending bills. If this party has a balance, bill-wise details may not be
                enabled for it in Tally.
              </div>
            ) : (
              <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Bill</th>
                      <th className="px-4 py-2.5 font-medium">Bill date</th>
                      <th className="px-4 py-2.5 font-medium">Due date</th>
                      <th className="px-4 py-2.5 font-medium text-right">Billed</th>
                      <th className="px-4 py-2.5 font-medium text-right">Pending</th>
                      <th className="px-4 py-2.5 font-medium text-right">Overdue by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openBills.map((b) => (
                      <tr key={b.bill_name} className="border-t border-slate-100 text-sm">
                        <td className="px-4 py-2 text-brand-slate">{b.bill_name}</td>
                        <td className="px-4 py-2 text-slate-500">{safeDate(b.bill_date) || "—"}</td>
                        <td className="px-4 py-2 text-slate-500">{safeDate(b.due_date) || "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {b.billed_amount ? inr(b.billed_amount) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-brand-slate">
                          {inr(b.pending_amount)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${
                            (b.days_overdue ?? 0) > 0 ? "text-red-600" : "text-slate-400"
                          }`}
                        >
                          {(b.days_overdue ?? 0) > 0 ? `${b.days_overdue} days` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {credits.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Plus {credits.length} unadjusted credit
                {credits.length === 1 ? "" : "s"} (advances / on account) totalling{" "}
                {inr(-credits.reduce((s, b) => s + b.pending_amount, 0))}.
              </p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-end justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-brand-slate">Ledger</h2>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-500">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                />
                <label className="text-slate-500">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => e.target.value && setTo(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                />
              </div>
            </div>
            <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Voucher</th>
                    <th className="px-4 py-2.5 font-medium">Narration</th>
                    <th className="px-4 py-2.5 font-medium text-right">Debit</th>
                    <th className="px-4 py-2.5 font-medium text-right">Credit</th>
                    <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-t border-slate-100 bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-500">{safeDate(from)}</td>
                    <td className="px-4 py-2 text-slate-500" colSpan={4}>
                      Opening balance
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-brand-slate whitespace-nowrap">
                      {drCr(ledger.opening)}
                    </td>
                  </tr>
                  {ledger.rows.map((e) => (
                    <tr key={e.guid} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{safeDate(e.date)}</td>
                      <td className="px-4 py-2 text-brand-slate whitespace-nowrap">
                        {e.voucher_type}
                        {e.voucher_number && (
                          <span className="text-slate-400"> #{e.voucher_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500 max-w-[280px] truncate" title={e.narration ?? ""}>
                        {e.narration || e.reference || ""}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700">
                        {e.amount > 0 ? inr(e.amount) : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700">
                        {e.amount < 0 ? inr(-e.amount) : ""}
                      </td>
                      <td className="px-4 py-2 text-right text-brand-slate whitespace-nowrap">
                        {drCr(e.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className="px-4 py-2 text-slate-500">{safeDate(to)}</td>
                    <td className="px-4 py-2 text-slate-600" colSpan={2}>
                      Closing balance · {ledger.rows.length} entries
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{inr(ledger.debit)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{inr(ledger.credit)}</td>
                    <td className="px-4 py-2 text-right text-brand-slate whitespace-nowrap">
                      {drCr(ledger.closing)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 ${strong ? "text-lg font-bold" : "text-base font-semibold"} ${
          warn ? "text-red-600" : "text-brand-slate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
