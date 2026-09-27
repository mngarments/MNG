"use client";

import { Gauge, AlertTriangle } from "lucide-react";

const GMAIL_LIMIT = 500;

export default function QuotaCounter({ sentToday }: { sentToday: number }) {
  const pct = Math.min(100, (sentToday / GMAIL_LIMIT) * 100);
  const near = sentToday >= GMAIL_LIMIT * 0.8;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-slate">
          <Gauge className="w-4 h-4 text-brand-navy" />
          Sent Today
        </div>
        {near && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            Near Gmail limit
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-bold text-brand-slate">{sentToday}</span>
        <span className="text-sm text-slate-400 mb-0.5">/ {GMAIL_LIMIT}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            near ? "bg-amber-500" : "bg-brand-navy"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
