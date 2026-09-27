import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Package,
  Building2,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { getPublicContent } from "@/lib/content";
import ArticleCard from "@/components/public/ArticleCard";
import WhatsAppBubble from "@/components/public/WhatsAppBubble";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublicContent();
  return {
    title: settings.seo_title || "MN Garments",
    description: settings.seo_description || "",
  };
}

function str(data: Record<string, unknown>, key: string, fallback = ""): string {
  const v = data[key];
  return typeof v === "string" && v ? v : fallback;
}

export default async function HomePage() {
  const { settings, sections, brands, sisterCompanies, catalog } =
    await getPublicContent();

  const brandName = settings.brand_name || "MN Garments";
  const whatsapp = settings.whatsapp_number || "";
  const hero = sections.hero?.data ?? {};
  const credentials =
    (sections.credentials?.data?.items as { value: string; label: string }[]) ??
    [];
  const brandsIntro = sections.brands_intro?.data ?? {};
  const sistersIntro = sections.sisters_intro?.data ?? {};
  const lookbookIntro = sections.lookbook_intro?.data ?? {};
  const footerNote = str(sections.footer?.data ?? {}, "note");

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-monogram.png"
              alt={brandName}
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <div className="font-bold text-brand-navy leading-tight">
                {brandName}
              </div>
              <div className="text-[11px] text-brand-gold-600">
                {settings.brand_tagline}
              </div>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
            <a href="#brands" className="hover:text-brand-navy">Brands</a>
            <a href="#group" className="hover:text-brand-navy">Group</a>
            <a href="#lookbook" className="hover:text-brand-navy">Lookbook</a>
            <a
              href="#contact"
              className="bg-brand-navy text-white rounded-lg px-4 py-2 hover:bg-brand-navy-700"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,#c4a77c_0,transparent_40%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-block text-xs uppercase tracking-[0.2em] text-brand-gold mb-4">
              {str(hero, "eyebrow", "Master Distributor · Ranchi")}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1]">
              {str(hero, "headline", "Premium menswear, distributed at scale.")}
            </h1>
            <p className="mt-6 text-lg text-slate-200 max-w-2xl">
              {str(hero, "subheadline", "")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={str(hero, "primary_cta_href", "#lookbook")}
                className="inline-flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-600 text-brand-navy-900 font-semibold rounded-lg px-6 py-3"
              >
                {str(hero, "primary_cta_label", "Browse Lookbook")}
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={str(hero, "secondary_cta_href", "#contact")}
                className="inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 text-white rounded-lg px-6 py-3"
              >
                {str(hero, "secondary_cta_label", "Talk to Sales")}
              </a>
            </div>
          </div>

          {credentials.length > 0 && (
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {credentials.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/15 bg-white/5 p-4"
                >
                  <div className="text-2xl font-bold text-brand-gold">
                    {c.value}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">{c.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Brand Portfolio */}
      <section id="brands" className="max-w-6xl mx-auto px-4 py-20 w-full">
        <SectionHeading
          heading={str(brandsIntro, "heading", "Brand Portfolio")}
          subheading={str(brandsIntro, "subheading")}
        />
        {brands.length === 0 ? (
          <EmptyNote text="Brands will appear here once added in the CRM." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {brands.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition"
              >
                {b.image_url && (
                  <div className="relative aspect-[16/9] bg-slate-100">
                    <Image
                      src={b.image_url}
                      alt={b.name}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-brand-slate">{b.name}</h3>
                    {b.is_ready_stock && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                        <Package className="w-3 h-3" /> Ready
                      </span>
                    )}
                  </div>
                  {b.tagline && (
                    <div className="text-xs text-brand-gold-600 font-medium mt-0.5">
                      {b.tagline}
                    </div>
                  )}
                  {b.description && (
                    <p className="text-sm text-slate-500 mt-2">
                      {b.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sister Companies */}
      <section id="group" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-20 w-full">
          <SectionHeading
            heading={str(sistersIntro, "heading", "Our Group of Companies")}
            subheading={str(sistersIntro, "subheading")}
          />
          {sisterCompanies.length === 0 ? (
            <EmptyNote text="Group companies will appear here once added in the CRM." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {sisterCompanies.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-navy/10 flex items-center justify-center mb-4">
                    <Building2 className="w-5 h-5 text-brand-navy" />
                  </div>
                  <h3 className="font-semibold text-brand-slate">{s.name}</h3>
                  {s.role && (
                    <div className="text-xs text-brand-gold-600 font-medium mt-0.5">
                      {s.role}
                    </div>
                  )}
                  {s.description && (
                    <p className="text-sm text-slate-500 mt-2">
                      {s.description}
                    </p>
                  )}
                  {s.location && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-3">
                      <MapPin className="w-3.5 h-3.5" /> {s.location}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lookbook */}
      <section id="lookbook" className="max-w-6xl mx-auto px-4 py-20 w-full">
        <SectionHeading
          heading={str(lookbookIntro, "heading", "Retailer Lookbook")}
          subheading={str(lookbookIntro, "subheading")}
        />
        {catalog.length === 0 ? (
          <EmptyNote text="Lookbook articles will appear here once added in the CRM." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {catalog.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                whatsapp={whatsapp}
                brandName={brandName}
              />
            ))}
          </div>
        )}
      </section>

      {/* Contact / Footer */}
      <footer
        id="contact"
        className="bg-brand-navy text-white mt-auto"
      >
        <div className="max-w-6xl mx-auto px-4 py-14 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src="/logo-monogram.png"
                  alt={brandName}
                  width={44}
                  height={44}
                  className="rounded-lg"
                />
                <div>
                  <div className="font-bold text-lg">{brandName}</div>
                  <div className="text-xs text-brand-gold">
                    {settings.brand_tagline}
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-300 max-w-md">{footerNote}</p>
            </div>
            <div className="md:text-right space-y-2 text-sm text-slate-200">
              {settings.address && (
                <div className="flex md:justify-end items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-gold" />
                  {settings.address}
                </div>
              )}
              {settings.phone && (
                <div className="flex md:justify-end items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-gold" />
                  {settings.phone}
                </div>
              )}
              {settings.sales_email && (
                <div className="flex md:justify-end items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-gold" />
                  {settings.sales_email}
                </div>
              )}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 text-xs text-slate-400">
            © {new Date().getFullYear()} {brandName}. All rights reserved.
          </div>
        </div>
      </footer>

      {whatsapp && (
        <WhatsAppBubble
          number={whatsapp}
          label={settings.whatsapp_label}
          brandName={brandName}
        />
      )}
    </div>
  );
}

function SectionHeading({
  heading,
  subheading,
}: {
  heading: string;
  subheading?: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brand-slate">
        {heading}
      </h2>
      {subheading && <p className="mt-3 text-slate-500">{subheading}</p>}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
