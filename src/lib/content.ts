import { getPublicClient } from "@/lib/supabase/public";
import type {
  Brand,
  CatalogItem,
  SisterCompany,
  SiteContent,
  SiteSection,
  SiteSettings,
} from "@/lib/types";

// Fallback content so the site renders even before Supabase is wired up.
export const DEFAULT_SETTINGS: SiteSettings = {
  brand_name: "MN Garments",
  brand_tagline: "Master Apparel Distributor · Ranchi",
  whatsapp_number: "919000000000",
  whatsapp_label: "Sales Desk",
  sales_email: "sales@mngarments.com",
  phone: "+91 90000 00000",
  address: "Upper Bazar, Ranchi, Jharkhand 834001",
  seo_title: "MN Garments — Master Apparel Distributor, Ranchi",
  seo_description:
    "Master Distributor for Van Heusen Athleisure, Twills, Brizzle, Status Quo & Mudo Jeans.",
};

export const DEFAULT_SECTIONS: Record<string, SiteSection> = {
  hero: {
    key: "hero",
    title: "Hero",
    is_visible: true,
    sort_order: 0,
    data: {
      eyebrow: "Master Distributor · Est. Ranchi",
      headline: "Premium menswear & athleisure, distributed at scale.",
      subheadline:
        "MN Garments is the master distributor for Van Heusen Athleisure and India's leading menswear brands across Jharkhand — ready stock, dealer-net pricing, and dependable fulfilment.",
      primary_cta_label: "Browse Lookbook",
      primary_cta_href: "#lookbook",
      secondary_cta_label: "Talk to Sales",
      secondary_cta_href: "#contact",
    },
  },
  credentials: {
    key: "credentials",
    title: "Wholesale Credentials",
    is_visible: true,
    sort_order: 1,
    data: {
      items: [
        { value: "5+", label: "Marquee Brands" },
        { value: "500+", label: "Retail Partners" },
        { value: "Ready", label: "Stock Availability" },
        { value: "Ranchi", label: "C&F Hub, Jharkhand" },
      ],
    },
  },
  brands_intro: {
    key: "brands_intro",
    title: "Brand Portfolio",
    is_visible: true,
    sort_order: 2,
    data: {
      heading: "Brand Portfolio",
      subheading:
        "Authorised distribution across premium menswear and athleisure labels.",
    },
  },
  sisters_intro: {
    key: "sisters_intro",
    title: "Sister Companies",
    is_visible: true,
    sort_order: 3,
    data: {
      heading: "Our Group of Companies",
      subheading:
        "A vertically integrated apparel group spanning wholesale, retail and kidswear.",
    },
  },
  lookbook_intro: {
    key: "lookbook_intro",
    title: "Retailer Lookbook",
    is_visible: true,
    sort_order: 4,
    data: {
      heading: "Retailer Lookbook",
      subheading:
        "Live articles with dealer-net rates. Order in one tap on WhatsApp.",
    },
  },
  footer: {
    key: "footer",
    title: "Footer",
    is_visible: true,
    sort_order: 5,
    data: {
      note: "MN Garments — Master Apparel Distributor. All prices are indicative dealer-net and exclusive of applicable GST.",
    },
  },
};

function settingsFromRows(
  rows: { key: string; value: unknown }[] | null
): SiteSettings {
  const map: SiteSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows ?? []) {
    map[r.key] =
      typeof r.value === "string" ? r.value : String(r.value ?? "");
  }
  return map;
}

/** Load all public, visible content for the one-pager. Falls back to defaults. */
export async function getPublicContent(): Promise<SiteContent> {
  const supabase = getPublicClient();
  if (!supabase) {
    return {
      settings: DEFAULT_SETTINGS,
      sections: DEFAULT_SECTIONS,
      brands: [],
      sisterCompanies: [],
      catalog: [],
    };
  }

  const [settingsRes, sectionsRes, brandsRes, sistersRes, catalogRes] =
    await Promise.all([
      supabase.from("site_settings").select("key,value"),
      supabase.from("site_sections").select("*").order("sort_order"),
      supabase
        .from("brands")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),
      supabase
        .from("sister_companies")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),
      supabase
        .from("catalog_items")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order"),
    ]);

  const sections: Record<string, SiteSection> = { ...DEFAULT_SECTIONS };
  for (const s of (sectionsRes.data ?? []) as SiteSection[]) {
    sections[s.key] = s;
  }

  return {
    settings: settingsFromRows(settingsRes.data),
    sections,
    brands: (brandsRes.data ?? []) as Brand[],
    sisterCompanies: (sistersRes.data ?? []) as SisterCompany[],
    catalog: (catalogRes.data ?? []) as CatalogItem[],
  };
}
