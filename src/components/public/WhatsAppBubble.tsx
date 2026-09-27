"use client";

import { MessageCircle } from "lucide-react";

export default function WhatsAppBubble({
  number,
  label,
  brandName,
}: {
  number: string;
  label?: string;
  brandName: string;
}) {
  const text = `Hi ${brandName}, I'd like to know more about your wholesale range.`;
  const href = `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(
    text
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1fb959] text-white rounded-full pl-4 pr-5 py-3 shadow-lg shadow-black/20 transition"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-sm font-medium">{label || "Chat with Sales"}</span>
    </a>
  );
}
