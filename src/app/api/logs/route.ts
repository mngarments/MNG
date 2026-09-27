import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const supabase = getAdminClient();
  let query = supabase
    .from("email_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ logs: data ?? [] });
}
