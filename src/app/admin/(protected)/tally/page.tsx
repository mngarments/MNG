"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoadError, { describeFailure } from "@/components/admin/LoadError";
import {
  RefreshCw,
  Loader2,
  Search,
  Wallet,
  Hourglass,
  TriangleAlert,
  Users,
  CircleCheck,
  XCircle,
  Clock,
} from "lucide-react";
import { inr, drCr, safeDate, dateTime } from "@/lib/format";
import { STALE_AFTER_HOURS } from "@/lib/tally/queries";
import type { TallyParty, TallySyncRun } from "@/lib/types";

type Filter = "outstanding" | "overdue" | "mismatch" | "all";

/** Tally's own closing balance vs. the one rebuilt from synced vouchers. */
function mismatch(p: TallyParty): boolean {
  return p.closing_balance != null && Math.abs(p.closing_balance - p.computed_balance) > 1;
}

export default function TallyPage() {
  const [parties, setParties] = useState<TallyParty[]>([]);
  const [runs, setRuns] = useState<TallySyncRun[]>([]);
  const [lastSuccess, setLastSuccess] = useState<TallySyncRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("outstanding");

  const [loadedAt, setLoadedAt] = useState(0);

  async function fetchData() {
    try {
      const res = await fetch("/api/tally/parties");
      if (!res.ok) return { error: await describeFailure(res) };
      return { json: await res.json() };
    } catch (err) {
      return { error: await describeFailure(null, err) };
    }
  }

  function apply(result: Awaited<ReturnType<typeof fetchData>>) {
    if (result.json) {
      setParties(result.json.parties);
      setRuns(result.json.runs);
      setLastSuccess(result.json.lastSuccess);
    }
    setLoadError(result.error ?? null);
    setLoadedAt(Date.now());
    setLoading(false);
  }

  function reload() {
    setLoading(true);
    fetchData().then(apply);
  }

  useEffect(() => {
    let cancelled = false;
    fetchData().then((r) => !cancelled && apply(r));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let overdueParties = 0;
    let mismatches = 0;
    for (const p of parties) {
      outstanding += p.bills_pending;
      overdue += p.overdue;
      if (p.overdue > 0) overdueParties++;
      if (mismatch(p)) mismatches++;
    }
    return { outstanding, overdue, overdueParties, mismatches };
  }, [parties]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties.filter((p) => {
      if (filter === "outstanding" && p.bills_pending <= 0 && p.computed_balance <= 0) return false;
      if (filter === "overdue" && p.overdue <= 0) return false;
      if (filter === "mismatch" && !mismatch(p)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.gstin ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.parent_group ?? "").toLowerCase().includes(q)
      );
    });
  }, [parties, query, filter]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-slate">Tally Accounts</h1>
          <p className="text-sm text-slate-500">
            Party balances, bills receivable and due dates, synced from Tally Prime.
          </p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      <LoadError message={loadError} />
      {!loading && !loadError && <SyncStatus runs={runs} lastSuccess={lastSuccess} now={loadedAt} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total receivable" value={inr(totals.outstanding, false)} icon={Wallet} />
        <Stat label="Overdue" value={inr(totals.overdue, false)} icon={Hourglass} tone="red" />
        <Stat label="Parties overdue" value={String(totals.overdueParties)} icon={Users} />
        <Stat
          label="Balance mismatches"
          value={String(totals.mismatches)}
          icon={TriangleAlert}
          tone={totals.mismatches ? "red" : "emerald"}
        />
      </div>

      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search party, GSTIN, phone, group…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(
            [
              ["outstanding", "With balance"],
              ["overdue", "Overdue"],
              ["mismatch", "Mismatch"],
              ["all", "All"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 ${
                filter === key ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          {visible.length} of {parties.length} parties
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          {parties.length === 0
            ? "No Tally data yet. It appears here after the agent on the Tally server completes its first sync."
            : "No parties match."}
        </div>
      ) : (
        <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Party</th>
                <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                <th className="px-4 py-2.5 font-medium text-right">Bills pending</th>
                <th className="px-4 py-2.5 font-medium text-right">Overdue</th>
                <th className="px-4 py-2.5 font-medium text-right">90+ days</th>
                <th className="px-4 py-2.5 font-medium">Oldest due</th>
                <th className="px-4 py-2.5 font-medium">Last entry</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.guid} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/tally/${encodeURIComponent(p.guid)}`}
                      className="text-sm text-brand-slate hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-[11px] text-slate-400">
                      {[p.parent_group, p.gstin, p.phone].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-brand-slate whitespace-nowrap">
                    {drCr(p.computed_balance)}
                    {mismatch(p) && (
                      <div
                        className="text-[11px] text-red-600 inline-flex items-center gap-1"
                        title="Tally's closing balance differs from the balance rebuilt from synced vouchers"
                      >
                        <TriangleAlert className="w-3 h-3" /> Tally: {drCr(p.closing_balance)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium text-brand-slate">
                    {p.bills_pending > 0 ? inr(p.bills_pending) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right text-sm ${
                      p.overdue > 0 ? "text-red-600 font-medium" : "text-slate-400"
                    }`}
                  >
                    {p.overdue > 0 ? inr(p.overdue) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-600">
                    {p.age_90_plus > 0 ? inr(p.age_90_plus) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {safeDate(p.oldest_due_date) || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {safeDate(p.last_voucher_date) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SyncStatus({
  runs,
  lastSuccess,
  now,
}: {
  runs: TallySyncRun[];
  lastSuccess: TallySyncRun | null;
  now: number;
}) {
  const latest = runs[0];
  if (!latest) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        The Tally agent hasn’t synced yet. Install it on the Tally server and run{" "}
        <code className="font-mono">node agent.mjs doctor</code>, then{" "}
        <code className="font-mono">node agent.mjs sync</code>.
      </div>
    );
  }

  const ageHours = lastSuccess
    ? (now - new Date(lastSuccess.finished_at ?? lastSuccess.started_at).getTime()) / 3_600_000
    : Infinity;
  const stale = ageHours > STALE_AFTER_HOURS;

  return (
    <div
      className={`mb-4 rounded-lg border p-3 text-sm ${
        stale || latest.status === "failed"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {latest.status === "success" ? (
          <CircleCheck className="w-4 h-4 text-emerald-600" />
        ) : latest.status === "failed" ? (
          <XCircle className="w-4 h-4 text-red-600" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
        )}
        <span>
          Last sync <strong>{latest.status}</strong> · {latest.kind} · {dateTime(latest.started_at)}
          {latest.company ? ` · ${latest.company}` : ""}
        </span>
        {lastSuccess && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" /> data as of {dateTime(lastSuccess.finished_at)}
          </span>
        )}
      </div>
      {latest.status === "failed" && latest.error && (
        <div className="mt-1 text-xs text-red-700">{latest.error}</div>
      )}
      {stale && (
        <div className="mt-1 text-xs">
          {lastSuccess
            ? `No successful sync for ${Math.floor(ageHours)} hours — these numbers may be out of date. Check that Tally and the agent are running on the server.`
            : "No sync has completed successfully yet, so these numbers may be incomplete."}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "emerald" | "red";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-brand-navy";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
        <Icon className={`w-4 h-4 ${toneClass}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-brand-slate mt-1">{value}</div>
    </div>
  );
}
