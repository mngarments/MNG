"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { buildStatementHtml } from "@/lib/email/buildStatementHtml";
import type { StagingRow } from "@/lib/types";

export default function PreviewEmailModal({
  row,
  onClose,
}: {
  row: StagingRow | null;
  onClose: () => void;
}) {
  const html = useMemo(() => {
    if (!row) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return buildStatementHtml({
      statement: row,
      logId: "preview",
      appUrl: origin,
    });
  }, [row]);

  if (!row) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <div className="text-sm font-semibold text-brand-slate">
              Email Preview
            </div>
            <div className="text-xs text-slate-500">
              {row.partyName} · {row.email ?? "no email on file"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <iframe
          title="Email preview"
          srcDoc={html}
          className="flex-1 w-full bg-slate-100"
          sandbox=""
        />
      </div>
    </div>
  );
}
