import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { parseCustomerImport, partyCodeKey } from "@/lib/csv/importCustomers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseCustomerImport(buffer, file.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse file";
    return Response.json({ error: message }, { status: 400 });
  }

  const { rows, notes, ignoredColumns } = parsed;
  if (rows.length === 0) {
    return Response.json(
      {
        error:
          "No rows with a Party Code found. The file needs a 'Party Code' column plus at least one of Email / Phone / Name.",
      },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  // Idempotent upsert by party_code. Only overwrite fields present in the file
  // so a partial contact sheet never wipes existing data.
  const now = new Date().toISOString();

  // Match each sheet code to an existing party loosely (case, spaces, leading
  // zeros), so a code formatted differently in Excel updates that party
  // instead of silently inserting a near-duplicate that nothing reads.
  const { data: existing, error: loadError } = await supabase
    .from("customers")
    .select("party_code,party_name");
  if (loadError) {
    return Response.json({ error: loadError.message }, { status: 500 });
  }
  const byKey = new Map(
    (existing ?? []).map((c) => [partyCodeKey(c.party_code), c])
  );

  const unmatched: string[] = [];
  const merged = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const match = byKey.get(partyCodeKey(r.party_code));
    if (!match) unmatched.push(r.party_code);
    const code = match?.party_code ?? r.party_code;
    const rec: Record<string, unknown> = {
      ...merged.get(code),
      party_code: code,
      party_name: r.party_name ?? match?.party_name ?? r.party_code,
      updated_at: now,
    };
    if (r.email !== undefined) rec.email = r.email;
    if (r.phone !== undefined) rec.phone = r.phone;
    if (r.gstin !== undefined) rec.gstin = r.gstin;
    merged.set(code, rec);
  }
  const payload = Array.from(merged.values());

  const { error, count } = await supabase
    .from("customers")
    .upsert(payload, { onConflict: "party_code", count: "exact" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const withEmail = rows.filter((r) => r.email).length;
  return Response.json({
    ok: true,
    processed: rows.length,
    upserted: count ?? payload.length,
    updated: payload.length - unmatched.length,
    created: unmatched.length,
    unmatchedCodes: unmatched.slice(0, 20),
    emailsProvided: withEmail,
    emailAddresses: rows.reduce(
      (n, r) => n + (r.email ? r.email.split(",").length : 0),
      0
    ),
    notes,
    ignoredColumns,
  });
}
