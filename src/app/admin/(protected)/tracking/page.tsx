"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  BellRing,
  Loader2,
  CheckCircle2,
  XCircle,
  MailOpen,
  Mail,
} from "lucide-react";
import { inr, dateTime } from "@/lib/format";
import type { Customer, EmailLog, PartyStatement } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 24 * 60 * 60 * 1000;

export default function TrackingPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(false);
  const [reminderProgress, setReminderProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    const [lRes, cRes] = await Promise.all([
      fetch("/api/logs"),
      fetch("/api/customers"),
    ]);
    if (lRes.ok) setLogs((await lRes.json()).logs);
    if (cRes.ok) {
      const { customers: list } = await cRes.json();
      const map: Record<string, Customer> = {};
      for (const c of list as Customer[]) map[c.party_code] = c;
      setCustomers(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const primary = logs.filter((l) => !l.is_reminder);
    const sent = primary.filter(
      (l) => l.status === "sent" || l.status === "opened"
    ).length;
    const opened = primary.filter((l) => l.status === "opened").length;
    const failed = primary.filter((l) => l.status === "failed").length;
    const openRate = sent ? Math.round((opened / sent) * 100) : 0;
    return { sent, opened, failed, openRate };
  }, [logs]);

  // Eligible reminders: primary sends, still 'sent' (unopened), older than 24h.
  const reminderTargets = useMemo(() => {
    const now = Date.now();
    // De-dupe by party (latest primary send only).
    const latestByParty = new Map<string, EmailLog>();
    for (const l of logs) {
      if (l.is_reminder || l.status !== "sent" || !l.sent_at) continue;
      const prev = latestByParty.get(l.party_code ?? "");
      if (!prev || new Date(l.sent_at) > new Date(prev.sent_at!)) {
        latestByParty.set(l.party_code ?? "", l);
      }
    }
    return Array.from(latestByParty.values()).filter(
      (l) => l.sent_at && now - new Date(l.sent_at).getTime() > DAY_MS
    );
  }, [logs]);

  async function sendReminders() {
    if (reminderTargets.length === 0) return;
    setReminding(true);
    setReminderProgress({ done: 0, total: reminderTargets.length });
    for (let i = 0; i < reminderTargets.length; i++) {
      const log = reminderTargets[i];
      const cust = customers[log.party_code ?? ""];
      const email = cust?.email ?? log.recipient_email;
      if (!email) {
        setReminderProgress({ done: i + 1, total: reminderTargets.length });
        continue;
      }
      // Minimal statement rebuilt from the log for the reminder body.
      const statement: PartyStatement = {
        partyCode: log.party_code ?? "",
        partyName: cust?.party_name ?? log.party_code ?? "Customer",
        gstin: cust?.gstin ?? "",
        beat: "",
        state: "",
        invoiceCount: log.invoice_count ?? 0,
        totalPieces: 0,
        taxableValue: 0,
        gst: 0,
        grandTotal: log.total_amount ?? 0,
        invoices: [],
      };
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statement,
            email,
            batchId: log.batch_id,
            isReminder: true,
          }),
        });
      } catch {
        /* continue */
      }
      setReminderProgress({ done: i + 1, total: reminderTargets.length });
      if (i < reminderTargets.length - 1) await sleep(3000);
    }
    setReminding(false);
    await load();
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-slate">
            Delivery &amp; Tracking
          </h1>
          <p className="text-sm text-slate-500">
            Who received and who opened their statement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={sendReminders}
            disabled={reminding || reminderTargets.length === 0}
            className="inline-flex items-center gap-2 bg-brand-gold-600 hover:bg-brand-gold text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            title={
              reminderTargets.length === 0
                ? "No unopened statements older than 24h"
                : ""
            }
          >
            {reminding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BellRing className="w-4 h-4" />
            )}
            Send Reminders ({reminderTargets.length})
          </button>
        </div>
      </header>

      {reminderProgress && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Reminder queue: {reminderProgress.done} / {reminderProgress.total}{" "}
          processed.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Sent" value={String(stats.sent)} icon={Mail} />
        <Stat
          label="Opened"
          value={String(stats.opened)}
          icon={MailOpen}
          tone="emerald"
        />
        <Stat label="Open Rate" value={`${stats.openRate}%`} icon={MailOpen} />
        <Stat
          label="Failed"
          value={String(stats.failed)}
          icon={XCircle}
          tone={stats.failed ? "red" : undefined}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No emails sent yet. Dispatch a batch from the Dispatch Hub to see
          delivery tracking here.
        </div>
      ) : (
        <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Party</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-sm text-brand-slate flex items-center gap-1.5">
                      {customers[l.party_code ?? ""]?.party_name ??
                        l.party_code}
                      {l.is_reminder && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                          reminder
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {l.party_code}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">
                    {l.recipient_email}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium text-brand-slate">
                    {l.total_amount != null ? inr(l.total_amount) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <LogStatus status={l.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {dateTime(l.sent_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {dateTime(l.opened_at)}
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

function LogStatus({ status }: { status: string }) {
  if (status === "opened")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Opened
      </span>
    );
  if (status === "sent")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Mail className="w-3.5 h-3.5" /> Sent
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <XCircle className="w-3.5 h-3.5" /> Failed
      </span>
    );
  return <span className="text-xs text-slate-400">{status}</span>;
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
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-red-600"
        : "text-brand-navy";
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
