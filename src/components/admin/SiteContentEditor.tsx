"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Plus, Trash2, Check } from "lucide-react";
import type { SiteSection, SiteSettings } from "@/lib/types";

const SETTING_FIELDS: { key: string; label: string; textarea?: boolean }[] = [
  { key: "brand_name", label: "Brand Name" },
  { key: "brand_tagline", label: "Tagline" },
  { key: "whatsapp_number", label: "WhatsApp Number (with country code, e.g. 9198…)" },
  { key: "whatsapp_label", label: "WhatsApp Label" },
  { key: "sales_email", label: "Sales Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address", textarea: true },
  { key: "seo_title", label: "SEO Title" },
  { key: "seo_description", label: "SEO Description", textarea: true },
];

const HERO_FIELDS: { key: string; label: string; textarea?: boolean }[] = [
  { key: "eyebrow", label: "Eyebrow" },
  { key: "headline", label: "Headline", textarea: true },
  { key: "subheadline", label: "Sub-headline", textarea: true },
  { key: "primary_cta_label", label: "Primary Button Label" },
  { key: "primary_cta_href", label: "Primary Button Link" },
  { key: "secondary_cta_label", label: "Secondary Button Label" },
  { key: "secondary_cta_href", label: "Secondary Button Link" },
];

const INTRO_SECTIONS = [
  { key: "brands_intro", label: "Brand Portfolio — Section Heading" },
  { key: "sisters_intro", label: "Sister Companies — Section Heading" },
  { key: "lookbook_intro", label: "Lookbook — Section Heading" },
];

function Input({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
        />
      )}
    </div>
  );
}

function Card({
  title,
  children,
  onSave,
  savedAt,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  savedAt: boolean;
  saving: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-brand-slate">{title}</h3>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm rounded-lg bg-brand-navy hover:bg-brand-navy-700 text-white px-3 py-1.5 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : savedAt ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {savedAt ? "Saved" : "Save"}
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type CredItem = { value: string; label: string };

export default function SiteContentEditor() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [sections, setSections] = useState<Record<string, SiteSection>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSections(data.sections);
      }
      setLoading(false);
    })();
  }, []);

  function flash(id: string) {
    setSaved(id);
    setTimeout(() => setSaved((s) => (s === id ? null : s)), 2000);
  }

  async function saveSettings() {
    setSaving("settings");
    await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setSaving(null);
    flash("settings");
  }

  async function saveSection(key: string, data: Record<string, unknown>, title?: string) {
    setSaving(key);
    await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: { key, data, title } }),
    });
    setSaving(null);
    flash(key);
  }

  function sectionData(key: string): Record<string, unknown> {
    return (sections[key]?.data as Record<string, unknown>) ?? {};
  }

  function setSectionField(key: string, field: string, value: unknown) {
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { key, title: null, is_visible: true, sort_order: 0, data: {} }),
        data: { ...sectionData(key), [field]: value },
      } as SiteSection,
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading content…
      </div>
    );
  }

  const cred = (sectionData("credentials").items as CredItem[]) ?? [];

  return (
    <div className="space-y-5">
      {/* Brand & Contact */}
      <Card
        title="Brand & Contact"
        onSave={saveSettings}
        saving={saving === "settings"}
        savedAt={saved === "settings"}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SETTING_FIELDS.map((f) => (
            <div key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
              <Input
                label={f.label}
                value={settings[f.key] ?? ""}
                textarea={f.textarea}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, [f.key]: v }))
                }
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Hero */}
      <Card
        title="Hero Section"
        onSave={() => saveSection("hero", sectionData("hero"), "Hero")}
        saving={saving === "hero"}
        savedAt={saved === "hero"}
      >
        {HERO_FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            textarea={f.textarea}
            value={String(sectionData("hero")[f.key] ?? "")}
            onChange={(v) => setSectionField("hero", f.key, v)}
          />
        ))}
      </Card>

      {/* Credentials */}
      <Card
        title="Wholesale Credentials (stat strip)"
        onSave={() =>
          saveSection("credentials", { items: cred }, "Wholesale Credentials")
        }
        saving={saving === "credentials"}
        savedAt={saved === "credentials"}
      >
        <div className="space-y-2">
          {cred.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={item.value}
                onChange={(e) => {
                  const next = [...cred];
                  next[idx] = { ...next[idx], value: e.target.value };
                  setSectionField("credentials", "items", next);
                }}
                placeholder="Value (e.g. 500+)"
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={item.label}
                onChange={(e) => {
                  const next = [...cred];
                  next[idx] = { ...next[idx], label: e.target.value };
                  setSectionField("credentials", "items", next);
                }}
                placeholder="Label (e.g. Retail Partners)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() =>
                  setSectionField(
                    "credentials",
                    "items",
                    cred.filter((_, i) => i !== idx)
                  )
                }
                className="p-2 rounded-lg text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setSectionField("credentials", "items", [
                ...cred,
                { value: "", label: "" },
              ])
            }
            className="inline-flex items-center gap-1.5 text-sm text-brand-navy hover:underline"
          >
            <Plus className="w-4 h-4" /> Add stat
          </button>
        </div>
      </Card>

      {/* Section headings */}
      {INTRO_SECTIONS.map((s) => (
        <Card
          key={s.key}
          title={s.label}
          onSave={() => saveSection(s.key, sectionData(s.key))}
          saving={saving === s.key}
          savedAt={saved === s.key}
        >
          <Input
            label="Heading"
            value={String(sectionData(s.key).heading ?? "")}
            onChange={(v) => setSectionField(s.key, "heading", v)}
          />
          <Input
            label="Sub-heading"
            textarea
            value={String(sectionData(s.key).subheading ?? "")}
            onChange={(v) => setSectionField(s.key, "subheading", v)}
          />
        </Card>
      ))}

      {/* Footer */}
      <Card
        title="Footer"
        onSave={() => saveSection("footer", sectionData("footer"), "Footer")}
        saving={saving === "footer"}
        savedAt={saved === "footer"}
      >
        <Input
          label="Footer note"
          textarea
          value={String(sectionData("footer").note ?? "")}
          onChange={(v) => setSectionField("footer", "note", v)}
        />
      </Card>
    </div>
  );
}
