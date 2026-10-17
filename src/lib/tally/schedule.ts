import type { TallyAgentSettings, TallySyncRun } from "@/lib/types";

// UI side of the agent's schedule (tally-agent/lib/schedule.mjs decides when
// to sync; keep the window logic here in step with it). Times are IST.

/** Interval choices offered in the portal (the agent checks in every 5 minutes). */
export const SYNC_INTERVALS = [5, 10, 15, 30, 60, 120, 240];

/** No check-in for this long means the agent or the Tally server is down. */
const AGENT_OFFLINE_AFTER_MS = 20 * 60_000;

const IST_OFFSET_MS = 330 * 60_000;

/** "23:00:00" → "23:00" (for <input type="time"> and display). */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

function minutes(time: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Inside the active window right now (null bounds = all day; may wrap midnight). */
export function inSyncHours(settings: TallyAgentSettings, now: number): boolean {
  const f = minutes(settings.active_from);
  const t = minutes(settings.active_to);
  if (f == null || t == null || f === t) return true;
  const m = Math.floor(((now + IST_OFFSET_MS) % 86_400_000) / 60_000);
  return f < t ? m >= f && m < t : m >= f || m < t;
}

export type SyncHealth =
  | { level: "ok" | "info" | "warn"; message: string | null };

/** What the status banner should say about how fresh the data is. */
export function syncHealth(
  settings: TallyAgentSettings | null,
  lastSuccess: TallySyncRun | null,
  now: number
): SyncHealth {
  if (!settings) return { level: "ok", message: null };
  const seen = settings.agent_last_seen_at ? Date.parse(settings.agent_last_seen_at) : 0;
  if (seen && now - seen > AGENT_OFFLINE_AFTER_MS) {
    return {
      level: "warn",
      message:
        "The agent on the Tally server hasn't checked in recently. The server may be off, or its scheduled task stopped.",
    };
  }
  if (!lastSuccess) {
    return { level: "warn", message: "No sync has completed successfully yet, so these numbers may be incomplete." };
  }
  if (!settings.enabled) {
    return { level: "info", message: "Automatic sync is off. Use Sync now to refresh." };
  }
  const age = now - Date.parse(lastSuccess.finished_at ?? lastSuccess.started_at);
  if (!inSyncHours(settings, now)) {
    return { level: "info", message: `Outside sync hours (${hhmm(settings.active_from)}–${hhmm(settings.active_to)}).` };
  }
  // Two missed intervals plus slack for the 5-minute check-in and the run itself.
  if (age > (settings.interval_minutes * 2 + 20) * 60_000) {
    return {
      level: "warn",
      message: "Scheduled syncs aren't succeeding, so these numbers may be out of date. Check that Tally is open on the server.",
    };
  }
  return { level: "ok", message: null };
}
