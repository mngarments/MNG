import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { parseCustomerImport } from "@/lib/csv/importCustomers";

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

  // Fetch existing names so inserts satisfy NOT NULL party_name.
  const codes = rows.map((r) => r.party_code);
  const { data: existing } = await supabase
    .from("customers")
    .select("party_code,party_name")
    .in("party_code", codes);
  const nameByCode = new Map(
    (existing ?? []).map((c) => [c.party_code, c.party_name])
  );

  const payload = rows.map((r) => {
    const rec: Record<string, unknown> = {
      party_code: r.party_code,
      party_name: r.party_name ?? nameByCode.get(r.party_code) ?? r.party_code,
      updated_at: now,
    };
    if (r.email !== undefined) rec.email = r.email;
    if (r.phone !== undefined) rec.phone = r.phone;
    if (r.gstin !== undefined) rec.gstin = r.gstin;
    return rec;
  });

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
    upserted: count ?? rows.length,
    emailsProvided: withEmail,
    emailAddresses: rows.reduce(
      (n, r) => n + (r.email ? r.email.split(",").length : 0),
      0
    ),
    notes,
    ignoredColumns,
  });
}
