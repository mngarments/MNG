"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageCircle, Link2, Check, Package, ImageIcon } from "lucide-react";
import { inr } from "@/lib/format";
import type { CatalogItem } from "@/lib/types";

export default function ArticleCard({
  item,
  whatsapp,
  brandName,
}: {
  item: CatalogItem;
  whatsapp: string;
  brandName: string;
}) {
  const [copied, setCopied] = useState(false);

  const orderText = [
    `Hi ${brandName}, I'd like to order:`,
    item.brand ? `Brand: ${item.brand}` : "",
    item.style_code ? `Style: ${item.style_code}` : "",
    item.mrp != null ? `MRP: ${inr(item.mrp)}` : "",
    item.dealer_net_rate != null
      ? `Dealer Net: ${inr(item.dealer_net_rate)}`
      : "",
    item.moq ? `MOQ: ${item.moq}` : "",
    item.size_curve ? `Sizes: ${item.size_curve}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const waHref = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    orderText
  )}`;

  async function copyLink() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/#article-${item.id}`
        : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      id={`article-${item.id}`}
      className="group rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col hover:shadow-lg transition scroll-mt-24"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={`${item.brand ?? ""} ${item.style_code ?? ""}`}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-10 h-10" />
          </div>
        )}
        {item.is_ready_stock && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-emerald-500 text-white text-[11px] font-medium rounded-full px-2.5 py-1">
            <Package className="w-3 h-3" /> Ready Stock
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-brand-gold-600 font-medium uppercase tracking-wide">
          {item.brand}
        </div>
        <div className="font-semibold text-brand-slate">
          {item.style_code}
        </div>
        {item.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-[11px] text-slate-400">MRP</div>
            <div className="font-medium text-slate-500 line-through">
              {item.mrp != null ? inr(item.mrp) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Dealer Net</div>
            <div className="font-bold text-brand-navy">
              {item.dealer_net_rate != null ? inr(item.dealer_net_rate) : "—"}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {item.moq && <span>MOQ: {item.moq}</span>}
          {item.size_curve && <span>Sizes: {item.size_curve}</span>}
        </div>

        <div className="mt-4 flex gap-2 pt-3 border-t border-slate-100">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1fb959] text-white text-sm font-medium rounded-lg px-3 py-2"
          >
            <MessageCircle className="w-4 h-4" /> Order
          </a>
          <button
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm rounded-lg px-3 py-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" /> Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
