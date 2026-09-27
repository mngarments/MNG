import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { readEntityBody } from "@/lib/apiEntity";

export const dynamic = "force-dynamic";

const NUMERIC = ["sort_order"];
const BOOL = ["is_ready_stock", "is_visible"];
const ALLOWED = [
  "name",
  "tagline",
  "description",
  "image_url",
  "is_ready_stock",
  "is_visible",
  "sort_order",
];

function pick(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("sort_order");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ brands: data ?? [] });
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = await readEntityBody(req, NUMERIC, BOOL);
  const record = pick(body);
  if (!record.name)
    return Response.json({ error: "Name is required" }, { status: 400 });
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .insert(record)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ brand: data });
}

export async function PATCH(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = await readEntityBody(req, NUMERIC, BOOL);
  const id = body.id;
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const record = { ...pick(body), updated_at: new Date().toISOString() };
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .update(record)
    .eq("id", id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ brand: data });
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const supabase = getAdminClient();
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
