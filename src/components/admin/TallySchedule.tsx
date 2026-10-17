"use client";

import { useState } from "react";
import { CalendarClock, Loader2, RefreshCw, DatabaseZap } from "lucide-react";
import { describeFailure } from "@/components/admin/LoadError";
import { dateTime } from "@/lib/format";
import { hhmm, SYNC_INTERVALS } from "@/lib/tally/schedule";
import type { TallyAgentSettings } from "@/lib/types";

interface Form {
  enabled: boolean;
  interval_minutes: number;
  allDay: boolean;
  active_from: string;
  active_to: string;
  full_sync_time: string;
}

function toForm(s: TallyAgentSettings): Form {
  return {
    enabled: s.enabled,
    interval_minutes: s.interval_minutes,
    allDay: !s.active_from || !s.active_to,
    active_from: hhmm(s.active_from) || "09:00",
    active_to: hhmm(s.active_to) || "21:00",
    full_sync_time: hhmm(s.full_sync_time),
  };
}

function intervalLabel(m: number): string {
  return m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`;
}

/** Sync schedule for the agent on the Tally server; it picks changes up within ~5 minutes. */
export default function TallySchedule({
  settings,
  onChange,
}: {
  settings: TallyAgentSettings;
  onChange: (s: TallyAgentSettings) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const [busy, setBusy] = useState<"save" | "sync" | "full" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const original = toForm(settings);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  async function call(kind: "save" | "sync" | "full", init: RequestInit) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/tally/settings", {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setError(await describeFailure(res));
      } else {
        const { settings: next } = await res.json();
        onChange(next);
        if (kind === "save") {
          setForm(toForm(next));
          setSaved(true);
        }
      }
    } catch (err) {
      setError(await describeFailure(null, err));
    }
    setBusy(null);
  }

  const save = () =>
    call("save", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: form.enabled,
        interval_minutes: form.interval_minutes,
        active_from: form.allDay ? null : form.active_from,
        active_to: form.allDay ? null : form.active_to,
        full_sync_time: form.full_sync_time,
      }),
    });

  const requestSync = (full: boolean) =>
    call(full ? "full" : "sync", { method: "POST", body: JSON.stringify({ full }) });

  const input = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-slate">
          <CalendarClock className="w-4 h-4 text-brand-navy" /> Sync schedule
          <span className="font-normal text-slate-400">(India time)</span>
        </h2>
        <span className="text-xs text-slate-500">
          {settings.agent_last_seen_at
            ? `Agent last checked in ${dateTime(settings.agent_last_seen_at)}${settings.agent_version ? ` · v${settings.agent_version}` : ""}`
            : "Agent hasn't checked in yet"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-brand-slate">Automatic sync</span>
            <span className="block text-xs text-slate-500">
              Off: syncs only run when you press Sync now.
            </span>
          </span>
        </label>

        <div>
          <div className="mb-1 font-medium text-brand-slate">Check for changes every</div>
          <select
            value={form.interval_minutes}
            disabled={!form.enabled}
            onChange={(e) => set("interval_minutes", Number(e.target.value))}
            className={input}
          >
            {SYNC_INTERVALS.map((m) => (
              <option key={m} value={m}>
                {intervalLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 font-medium text-brand-slate">Sync hours</div>
          <label className="mr-3 inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={form.allDay}
              disabled={!form.enabled}
              onChange={() => set("allDay", true)}
            />
            All day
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={!form.allDay}
              disabled={!form.enabled}
              onChange={() => set("allDay", false)}
            />
            Only between
          </label>
          {!form.allDay && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="time"
                value={form.active_from}
                disabled={!form.enabled}
                onChange={(e) => set("active_from", e.target.value)}
                className={input}
              />
              <span className="text-slate-400">and</span>
              <input
                type="time"
                value={form.active_to}
                disabled={!form.enabled}
                onChange={(e) => set("active_to", e.target.value)}
                className={input}
              />
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 font-medium text-brand-slate">Full sync daily at</div>
          <input
            type="time"
            value={form.full_sync_time}
            disabled={!form.enabled}
            onChange={(e) => set("full_sync_time", e.target.value)}
            className={input}
          />
          <p className="mt-1 text-xs text-slate-500">
            Re-reads everything to catch deleted entries and can slow Tally for a few minutes.
            Pick a time when Tally is open but not busy. If it’s closed then, the agent keeps
            trying for 3 hours.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
        <button
          onClick={save}
          disabled={!dirty || busy !== null}
          className="inline-flex items-center gap-2 bg-brand-gold-600 hover:bg-brand-gold text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save schedule
        </button>
        <button
          onClick={() => requestSync(false)}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync now
        </button>
        <button
          onClick={() => requestSync(true)}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          title="Re-reads all of Tally; can slow it for a few minutes"
        >
          {busy === "full" ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
          Full sync now
        </button>
        {saved && !dirty && <span className="text-xs text-emerald-700">Saved. The agent applies it within 5 minutes.</span>}
        {settings.sync_requested_at && (
          <span className="text-xs text-amber-700">
            {settings.sync_requested_full ? "Full sync" : "Sync"} requested at{" "}
            {dateTime(settings.sync_requested_at)}. The agent starts it within 5 minutes.
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </section>
  );
}
