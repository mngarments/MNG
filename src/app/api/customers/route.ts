import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("party_name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ customers: data ?? [] });
}

// Upsert a single customer's contact details (used by the inline "Save email").
export async function PATCH(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: {
    party_code?: string;
    party_name?: string;
    email?: string;
    phone?: string;
    gstin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partyCode = body.party_code?.trim();
  if (!partyCode) {
    return Response.json({ error: "party_code is required" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const payload: Record<string, unknown> = {
    party_code: partyCode,
    updated_at: new Date().toISOString(),
  };
  if (body.party_name !== undefined) payload.party_name = body.party_name;
  if (body.email !== undefined) payload.email = email || null;
  if (body.phone !== undefined) payload.phone = body.phone?.trim() || null;
  if (body.gstin !== undefined) payload.gstin = body.gstin?.trim() || null;

  // Ensure party_name exists on insert (NOT NULL); default to the code.
  if (payload.party_name === undefined) {
    const { data: existing } = await supabase
      .from("customers")
      .select("party_name")
      .eq("party_code", partyCode)
      .maybeSingle();
    payload.party_name = existing?.party_name ?? partyCode;
  }

  const { data, error } = await supabase
    .from("customers")
    .upsert(payload, { onConflict: "party_code" })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ customer: data });
}
