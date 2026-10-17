import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/tally/queries";
import type { TallyAgentSettings, TallyParty, TallySyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Every debtor with outstanding/aging totals, plus recent sync runs and the schedule. */
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const supabase = getAdminClient();

  try {
    const [parties, runsRes] = await Promise.all([
      fetchAllPages<TallyParty>((from, to) =>
        supabase
          .from("v_tally_party_outstanding")
          .select("*")
          .order("bills_pending", { ascending: false })
          .order("guid")
          .range(from, to)
      ),
      supabase
        .from("tally_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    if (runsRes.error) throw new Error(runsRes.error.message);

    // Most recent successful run, which may be older than the last 10 attempts.
    const { data: lastSuccess, error } = await supabase
      .from("tally_sync_runs")
      .select("*")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: settings, error: settingsError } = await supabase
      .from("tally_agent_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (settingsError) throw new Error(settingsError.message);

    return Response.json({
      parties,
      runs: (runsRes.data ?? []) as TallySyncRun[],
      lastSuccess: lastSuccess as TallySyncRun | null,
      settings: settings as TallyAgentSettings,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load Tally data" },
      { status: 500 }
    );
  }
}
