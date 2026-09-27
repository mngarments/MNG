"use client";

import { RotateCcw, X } from "lucide-react";

export default function ResumeBanner({
  sentCount,
  nextIndex,
  onResume,
  onDismiss,
}: {
  sentCount: number;
  nextIndex: number;
  onResume: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-900">
            Unfinished batch found
          </div>
          <div className="text-xs text-amber-700">
            {sentCount} customer{sentCount === 1 ? "" : "s"} already received this
            batch. Resume from customer #{nextIndex + 1} — already-sent parties
            are skipped, so no duplicate emails go out.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onResume}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg px-3 py-2"
        >
          Resume Batch
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
