"use client";

import { useState } from "react";
import { Eye, Check, Loader2, MailWarning, CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";
import { inr } from "@/lib/format";
import type { StagingRow } from "@/lib/types";

export type SendState =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped"
  | "opened";

function StatusBadge({ state }: { state: SendState | undefined }) {
  switch (state) {
    case "sending":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-brand-navy">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending
        </span>
      );
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" /> Sent
        </span>
      );
    case "opened":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Opened
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <XCircle className="w-3.5 h-3.5" /> Failed
        </span>
      );
    case "skipped":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <MinusCircle className="w-3.5 h-3.5" /> Skipped
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" /> Ready
        </span>
      );
  }
}

function EmailCell({
  row,
  onSave,
}: {
  row: StagingRow;
  onSave: (partyCode: string, email: string) => Promise<void>;
}) {
  const [value, setValue] = useState(row.email ?? "");
  const [saving, setSaving] = useState(false);

  if (row.hasEmail) {
    return <span className="text-sm text-slate-600">{row.email}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap">
        <MailWarning className="w-3 h-3" /> Missing
      </span>
      <input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="add email…"
        className="w-40 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
      <button
        disabled={saving || !value.trim()}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(row.partyCode, value.trim());
          } finally {
            setSaving(false);
          }
        }}
        className="inline-flex items-center justify-center rounded bg-brand-navy text-white w-6 h-6 disabled:opacity-40"
        title="Save email"
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Check className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

export default function StagingTable({
  rows,
  statusMap,
  onSaveEmail,
  onPreview,
}: {
  rows: StagingRow[];
  statusMap: Record<string, SendState>;
  onSaveEmail: (partyCode: string, email: string) => Promise<void>;
  onPreview: (row: StagingRow) => void;
}) {
  return (
    <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left border-collapse min-w-[820px]">
        <thead>
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Party</th>
            <th className="px-4 py-2.5 font-medium text-center">Inv</th>
            <th className="px-4 py-2.5 font-medium text-center">Pcs</th>
            <th className="px-4 py-2.5 font-medium text-right">Grand Total</th>
            <th className="px-4 py-2.5 font-medium">Email</th>
            <th className="px-4 py-2.5 font-medium text-right">Preview</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-sm text-slate-400"
              >
                No parties match the current filter.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.partyCode}
              className="border-t border-slate-100 hover:bg-slate-50/60"
            >
              <td className="px-4 py-2.5">
                <StatusBadge state={statusMap[row.partyCode]} />
              </td>
              <td className="px-4 py-2.5">
                <div className="text-sm font-medium text-brand-slate">
                  {row.partyName}
                </div>
                <div className="text-[11px] text-slate-400">
                  {row.partyCode}
                  {row.beat ? ` · ${row.beat}` : ""}
                </div>
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-slate-600">
                {row.invoiceCount}
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-slate-600">
                {row.totalPieces}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold text-brand-slate">
                {inr(row.grandTotal)}
              </td>
              <td className="px-4 py-2.5">
                <EmailCell row={row} onSave={onSaveEmail} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onPreview(row)}
                  className="inline-flex items-center gap-1 text-xs text-brand-navy hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
