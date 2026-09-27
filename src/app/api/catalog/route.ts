import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { readEntityBody } from "@/lib/apiEntity";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NUMERIC = ["mrp", "dealer_net_rate", "sort_order"];
const BOOL = ["is_ready_stock", "is_visible"];
const ALLOWED = [
  "brand",
  "style_code",
  "description",
  "mrp",
  "dealer_net_rate",
  "moq",
  "size_curve",
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
    .from("catalog_items")
    .select("*")
    .order("sort_order");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  let body: Record<string, unknown>;
  try {
    body = await readEntityBody(req, NUMERIC, BOOL);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 }
    );
  }
  const record = pick(body);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .insert(record)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}

export async function PATCH(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  let body: Record<string, unknown>;
  try {
    body = await readEntityBody(req, NUMERIC, BOOL);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 }
    );
  }
  const id = body.id;
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const record = { ...pick(body), updated_at: new Date().toISOString() };
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .update(record)
    .eq("id", id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const supabase = getAdminClient();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
