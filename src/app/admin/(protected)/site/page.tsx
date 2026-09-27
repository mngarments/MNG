"use client";

import { useState } from "react";
import SiteContentEditor from "@/components/admin/SiteContentEditor";
import CrudManager, { type CrudConfig } from "@/components/admin/CrudManager";

const BRANDS_CONFIG: CrudConfig = {
  title: "Brand Portfolio",
  description: "Marquee brands shown in the portfolio grid.",
  endpoint: "/api/brands",
  collectionKey: "brands",
  itemKey: "brand",
  titleField: "name",
  subtitleField: "tagline",
  imageField: "image_url",
  addLabel: "Add Brand",
  fields: [
    { name: "name", label: "Brand Name", type: "text" },
    { name: "tagline", label: "Tagline", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "image_url", label: "Brand Image", type: "image" },
    { name: "is_ready_stock", label: "Show “Ready Stock” badge", type: "checkbox" },
    { name: "is_visible", label: "Visible on website", type: "checkbox" },
    { name: "sort_order", label: "Sort order", type: "number", half: true },
  ],
};

const SISTERS_CONFIG: CrudConfig = {
  title: "Sister Companies",
  description: "Group companies shown in the overview cards.",
  endpoint: "/api/sister-companies",
  collectionKey: "companies",
  itemKey: "company",
  titleField: "name",
  subtitleField: "role",
  imageField: "image_url",
  addLabel: "Add Company",
  fields: [
    { name: "name", label: "Company Name", type: "text" },
    { name: "role", label: "Role (e.g. Corporate Wholesale & C&F)", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "location", label: "Location", type: "text" },
    { name: "image_url", label: "Image / Logo", type: "image" },
    { name: "is_visible", label: "Visible on website", type: "checkbox" },
    { name: "sort_order", label: "Sort order", type: "number", half: true },
  ],
};

const CATALOG_CONFIG: CrudConfig = {
  title: "Retailer Lookbook",
  description: "Article cards with dealer-net rates shown to retailers.",
  endpoint: "/api/catalog",
  collectionKey: "items",
  itemKey: "item",
  titleField: "style_code",
  subtitleField: "brand",
  imageField: "image_url",
  addLabel: "Add Article",
  fields: [
    { name: "brand", label: "Brand", type: "text", half: true },
    { name: "style_code", label: "Style Code", type: "text", half: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "mrp", label: "MRP (₹)", type: "number", half: true },
    { name: "dealer_net_rate", label: "Dealer Net Rate (₹)", type: "number", half: true },
    { name: "moq", label: "MOQ", type: "text", half: true },
    { name: "size_curve", label: "Size Curve", type: "text", half: true },
    { name: "image_url", label: "Article Image", type: "image" },
    { name: "is_ready_stock", label: "Ready stock", type: "checkbox" },
    { name: "is_visible", label: "Visible on website", type: "checkbox" },
    { name: "sort_order", label: "Sort order", type: "number", half: true },
  ],
};

const TABS = [
  { id: "content", label: "Content & Contact" },
  { id: "brands", label: "Brands" },
  { id: "sisters", label: "Sister Companies" },
  { id: "lookbook", label: "Lookbook" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SiteCrmPage() {
  const [tab, setTab] = useState<TabId>("content");

  return (
    <div className="p-6 lg:p-8 max-w-[1000px]">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-slate">Website CRM</h1>
        <p className="text-sm text-slate-500">
          Everything on the public one-pager is editable here. Changes go live
          immediately.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition ${
              tab === t.id
                ? "border-brand-navy text-brand-navy"
                : "border-transparent text-slate-500 hover:text-brand-slate"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "content" && <SiteContentEditor />}
      {tab === "brands" && <CrudManager config={BRANDS_CONFIG} />}
      {tab === "sisters" && <CrudManager config={SISTERS_CONFIG} />}
      {tab === "lookbook" && <CrudManager config={CATALOG_CONFIG} />}
    </div>
  );
}
