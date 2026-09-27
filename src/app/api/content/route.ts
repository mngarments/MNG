import { requireAuth } from "@/lib/auth/guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SECTIONS, DEFAULT_SETTINGS } from "@/lib/content";
import type { SiteSection, SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

// Admin read: settings + sections (merged with defaults).
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const supabase = getAdminClient();
  const [sRes, secRes] = await Promise.all([
    supabase.from("site_settings").select("key,value"),
    supabase.from("site_sections").select("*").order("sort_order"),
  ]);

  const settings: SiteSettings = { ...DEFAULT_SETTINGS };
  for (const r of sRes.data ?? []) {
    settings[r.key] =
      typeof r.value === "string" ? r.value : String(r.value ?? "");
  }

  const sections: Record<string, SiteSection> = { ...DEFAULT_SECTIONS };
  for (const s of (secRes.data ?? []) as SiteSection[]) sections[s.key] = s;

  return Response.json({ settings, sections });
}

// Admin write: upsert changed settings and/or a section's data.
export async function PUT(req: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: {
    settings?: Record<string, string>;
    section?: { key: string; data: Record<string, unknown>; title?: string };
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const now = new Date().toISOString();

  if (body.settings) {
    const rows = Object.entries(body.settings).map(([key, value]) => ({
      key,
      value: value as unknown as object, // stored as jsonb string
      updated_at: now,
    }));
    if (rows.length) {
      const { error } = await supabase
        .from("site_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.section?.key) {
    const { error } = await supabase.from("site_sections").upsert(
      {
        key: body.section.key,
        title: body.section.title ?? null,
        data: body.section.data,
        updated_at: now,
      },
      { onConflict: "key" }
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
