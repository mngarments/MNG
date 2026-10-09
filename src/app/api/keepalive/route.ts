import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Daily Vercel Cron hit. Supabase pauses free projects after ~7 days without
// activity, so this runs a trivial query to keep the project awake. A non-2xx
// response shows up as a failed cron run in Vercel.
export async function GET(req: Request) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Fail closed if unset.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await getAdminClient()
    .from("site_settings")
    .select("*", { count: "exact", head: true });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 503 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
