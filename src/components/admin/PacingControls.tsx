"use client";

import { Play, Pause, Square, Send, Loader2, Timer } from "lucide-react";

export type Throttle = 5 | 3 | 2;
export type QueueState = "idle" | "running" | "paused";

const SPEEDS: { value: Throttle; label: string }[] = [
  { value: 5, label: "Conservative · 5s" },
  { value: 3, label: "Balanced · 3s" },
  { value: 2, label: "Fast · 2s" },
];

export default function PacingControls({
  state,
  throttle,
  onThrottle,
  onStart,
  onPause,
  onResume,
  onCancel,
  countdown,
  progress,
  readyCount,
  isReminderMode,
}: {
  state: QueueState;
  throttle: Throttle;
  onThrottle: (t: Throttle) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  countdown: number;
  progress: { done: number; total: number };
  readyCount: number;
  isReminderMode: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-brand-slate">
          {isReminderMode ? "Reminder Queue" : "Dispatch Queue"}
        </div>
        {state !== "idle" && (
          <div className="text-xs text-slate-500">
            {progress.done} / {progress.total} processed
          </div>
        )}
      </div>

      {/* Throttle selector */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5">Throttle speed</div>
        <div className="grid grid-cols-3 gap-1.5">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => onThrottle(s.value)}
              disabled={state === "running"}
              className={`text-xs rounded-lg px-2 py-2 border transition disabled:opacity-50 ${
                throttle === s.value
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-slate-200 text-slate-600 hover:border-brand-navy/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {state !== "idle" && (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-brand-gold transition-all"
            style={{
              width: `${
                progress.total ? (progress.done / progress.total) * 100 : 0
              }%`,
            }}
          />
        </div>
      )}

      {/* Countdown */}
      {state === "running" && countdown > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Timer className="w-4 h-4 text-brand-gold-600" />
          Next send in <span className="font-semibold">{countdown}s</span>
        </div>
      )}
      {state === "running" && countdown === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
          Sending…
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {state === "idle" && (
          <button
            onClick={onStart}
            disabled={readyCount === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy-700 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            <Send className="w-4 h-4" />
            {isReminderMode
              ? `Send ${readyCount} Reminder${readyCount === 1 ? "" : "s"}`
              : `Start Dispatch (${readyCount})`}
          </button>
        )}
        {state === "running" && (
          <button
            onClick={onPause}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
        {state === "paused" && (
          <button
            onClick={onResume}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-navy-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        {state !== "idle" && (
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-4 py-2.5 text-sm font-medium transition"
          >
            <Square className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
