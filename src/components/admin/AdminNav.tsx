"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Send,
  LayoutGrid,
  Users,
  BarChart3,
  LogOut,
  ExternalLink,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dispatch Hub", icon: Send, exact: true },
  { href: "/admin/tracking", label: "Delivery & Tracking", icon: BarChart3 },
  { href: "/admin/customers", label: "Customer Directory", icon: Users },
  { href: "/admin/site", label: "Website CRM", icon: LayoutGrid },
];

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-brand-navy text-white flex flex-col min-h-screen sticky top-0 h-screen">
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <Image
          src="/logo-monogram.png"
          alt="MN"
          width={40}
          height={40}
          className="rounded-lg"
        />
        <div>
          <div className="text-sm font-semibold leading-tight">MN Garments</div>
          <div className="text-xs text-brand-gold">Distributor Console</div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
        >
          <ExternalLink className="w-4 h-4" />
          View Website
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <div className="px-3 pt-2 text-[11px] text-white/40 truncate">
          {email}
        </div>
      </div>
    </aside>
  );
}
