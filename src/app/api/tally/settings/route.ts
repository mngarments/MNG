import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { SYNC_INTERVALS } from "@/lib/tally/schedule";
import type { TallyAgentSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

// The Tally agent's sync schedule (single row). The agent reads it on each
// 5-minute check-in, so changes apply within about 5 minutes.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { data, error } = await getAdminClient()
    .from("tally_agent_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return bad(error.message, 500);
  return Response.json({ settings: data as TallyAgentSettings });
}

/** Save the schedule. Times are IST "HH:MM"; the active window is both-or-neither. */
export async function PATCH(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await req.json()) as Partial<{
    enabled: boolean;
    interval_minutes: number;
    active_from: string | null;
    active_to: string | null;
    full_sync_time: string;
  }>;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) update.enabled = Boolean(body.enabled);
  if (body.interval_minutes !== undefined) {
    if (!SYNC_INTERVALS.includes(Number(body.interval_minutes))) {
      return bad(`Interval must be one of ${SYNC_INTERVALS.join(", ")} minutes`);
    }
    update.interval_minutes = Number(body.interval_minutes);
  }
  if (body.active_from !== undefined || body.active_to !== undefined) {
    const from = body.active_from || null;
    const to = body.active_to || null;
    if (Boolean(from) !== Boolean(to)) return bad("Set both sync-hours times, or neither");
    if ((from && !TIME_RE.test(from)) || (to && !TIME_RE.test(to))) {
      return bad("Sync hours must be HH:MM");
    }
    if (from && from === to) return bad("Sync hours start and end can't be the same");
    update.active_from = from;
    update.active_to = to;
  }
  if (body.full_sync_time !== undefined) {
    if (!TIME_RE.test(body.full_sync_time)) return bad("Full sync time must be HH:MM");
    update.full_sync_time = body.full_sync_time;
  }

  const { data, error } = await getAdminClient()
    .from("tally_agent_settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return Response.json({ settings: data as TallyAgentSettings });
}

/** "Sync now": the agent picks it up on its next check-in. */
export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { full } = (await req.json().catch(() => ({}))) as { full?: boolean };
  const supabase = getAdminClient();

  // Never downgrade a pending full-sync request to an incremental one.
  const { data: current, error: readError } = await supabase
    .from("tally_agent_settings")
    .select("sync_requested_at, sync_requested_full")
    .eq("id", 1)
    .single();
  if (readError) return bad(readError.message, 500);

  const { data, error } = await supabase
    .from("tally_agent_settings")
    .update({
      sync_requested_at: new Date().toISOString(),
      sync_requested_full:
        Boolean(full) || Boolean(current.sync_requested_at && current.sync_requested_full),
    })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return bad(error.message, 500);
  return Response.json({ settings: data as TallyAgentSettings });
}
