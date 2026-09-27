import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Create a new dispatch batch.
export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: { label?: string; source_filename?: string; total_parties?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("dispatch_batches")
    .insert({
      label: body.label ?? null,
      source_filename: body.source_filename ?? null,
      total_parties: body.total_parties ?? 0,
      status: "active",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ batch: data });
}

// Resume state: last resumable batch + which parties it already sent + today's quota.
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const supabase = getAdminClient();

  const { data: batches } = await supabase
    .from("dispatch_batches")
    .select("*")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);

  const batch = batches?.[0] ?? null;

  let sentPartyCodes: string[] = [];
  if (batch) {
    const { data: logs } = await supabase
      .from("email_logs")
      .select("party_code")
      .eq("batch_id", batch.id)
      .eq("is_reminder", false)
      .in("status", ["sent", "opened"]);
    sentPartyCodes = Array.from(
      new Set((logs ?? []).map((l) => l.party_code).filter(Boolean) as string[])
    );
  }

  // Today's sent count (Gmail quota tracker).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", startOfDay.toISOString())
    .in("status", ["sent", "opened"]);

  return Response.json({
    batch,
    sentPartyCodes,
    sentToday: sentToday ?? 0,
  });
}

// Update batch status (paused | active | completed | cancelled).
export async function PATCH(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: { id?: string; status?: string; sent_count?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (typeof body.sent_count === "number") patch.sent_count = body.sent_count;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("dispatch_batches")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ batch: data });
}
