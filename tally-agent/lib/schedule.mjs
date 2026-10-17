// Decides, on each 5-minute check-in, whether to sync now. The schedule is
// set in the MNG portal (tally_agent_settings); times are India time (IST,
// UTC+5:30, no daylight saving).

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
// A missed full sync (e.g. Tally closed at that time) is retried for this long,
// then skipped until the next day, so it never drifts into working hours.
export const FULL_SYNC_RETRY_MS = 3 * 3_600_000;

/** "23:00" / "23:00:00" → minutes after midnight (null if empty/invalid). */
export function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes < 1440 ? minutes : null;
}

/** Minutes after midnight IST for an epoch-ms instant. */
export function istMinutes(now) {
  return Math.floor(((now + IST_OFFSET_MS) % DAY_MS) / 60_000);
}

/** Inside [from, to) IST; null bounds mean all day; from > to wraps midnight. */
export function inWindow(from, to, now) {
  const f = parseTime(from);
  const t = parseTime(to);
  if (f == null || t == null || f === t) return true;
  const m = istMinutes(now);
  return f < t ? m >= f && m < t : m >= f || m < t;
}

/** The most recent instant (epoch ms, at or before `now`) the daily full sync was due. */
export function lastFullSyncDue(fullSyncTime, now) {
  const minutes = parseTime(fullSyncTime) ?? 23 * 60;
  const istMidnight = now - ((now + IST_OFFSET_MS) % DAY_MS);
  const today = istMidnight + minutes * 60_000;
  return today <= now ? today : today - DAY_MS;
}

const ms = (iso) => (iso ? Date.parse(iso) : 0);

/** True until a full sync has succeeded on this machine. */
export function needsFull(state) {
  return state.lastAlterId == null || !state.lastFullSuccessAt;
}

/**
 * Returns { kind: "full" | "incremental", reason } or null (nothing to do).
 * `settings` is the tally_agent_settings row; `state` is the agent's state.json.
 */
export function decide(settings, state, now = Date.now()) {
  // An explicit "Sync now" from the portal runs even when automatic sync is off.
  if (settings.sync_requested_at) {
    const full = settings.sync_requested_full || needsFull(state);
    return { kind: full ? "full" : "incremental", reason: "requested from the portal" };
  }
  if (!settings.enabled) return null;

  const due = lastFullSyncDue(settings.full_sync_time, now);
  if (now - due < FULL_SYNC_RETRY_MS && ms(state.lastFullStartedAt) < due) {
    return { kind: "full", reason: "scheduled daily full sync" };
  }

  // Never synced fully here yet: wait for the scheduled time or a portal request.
  if (needsFull(state)) return null;
  if (!inWindow(settings.active_from, settings.active_to, now)) return null;

  const intervalMs = Math.max(5, Number(settings.interval_minutes) || 15) * 60_000;
  // A minute of slack so 5-minute check-ins don't miss a 15-minute slot.
  if (now - ms(state.lastRunStartedAt) < intervalMs - 60_000) return null;
  return { kind: "incremental", reason: "scheduled" };
}
