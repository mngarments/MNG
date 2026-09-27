"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Search,
  Check,
  Loader2,
  MailWarning,
  Download,
} from "lucide-react";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/customers");
    if (res.ok) {
      const { customers: list } = await res.json();
      setCustomers(list);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.party_name} ${c.party_code} ${c.email ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  const missingCount = customers.filter((c) => !c.email).length;

  async function handleImport(file: File) {
    setImporting(true);
    setImportMsg(null);
    setImportErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/customers/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportMsg(
        `Processed ${data.processed} rows · ${data.emailsProvided} with email. Existing records updated in place (no duplicates).`
      );
      await load();
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1100px]">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-slate">
            Customer Directory
          </h1>
          <p className="text-sm text-slate-500">
            {customers.length} parties · {missingCount} missing email. Emails
            saved here auto-fill on every future dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 bg-brand-navy hover:bg-brand-navy-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import CSV / Excel
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4 text-xs text-slate-500 flex items-start gap-2">
        <Download className="w-4 h-4 shrink-0 mt-0.5 text-brand-navy" />
        Upload a sheet with a <b className="mx-1">Party Code</b> column plus{" "}
        <b className="mx-1">Email</b> / Phone / Name. Re-uploading updates
        matching parties by code — it never creates duplicates.
      </div>

      {importMsg && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {importMsg}
        </div>
      )}
      {importErr && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {importErr}
        </div>
      )}

      <div className="relative mb-3 max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code or email…"
          className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto thin-scroll rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Party</th>
                <th className="px-4 py-2.5 font-medium">GSTIN</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <EditableRow
                  key={c.party_code}
                  customer={c}
                  onSaved={(updated) =>
                    setCustomers((prev) =>
                      prev.map((x) =>
                        x.party_code === updated.party_code ? updated : x
                      )
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditableRow({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: (c: Customer) => void;
}) {
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    email !== (customer.email ?? "") || phone !== (customer.phone ?? "");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_code: customer.party_code,
          party_name: customer.party_name,
          email,
          phone,
        }),
      });
      if (res.ok) {
        const { customer: updated } = await res.json();
        onSaved(updated);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-4 py-2.5">
        <div className="text-sm font-medium text-brand-slate">
          {customer.party_name}
        </div>
        <div className="text-[11px] text-slate-400">{customer.party_code}</div>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500">
        {customer.gstin ?? "—"}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {!customer.email && (
            <MailWarning className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="add email…"
            className="w-52 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="phone"
            className="w-32 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center rounded bg-brand-navy text-white w-6 h-6 disabled:opacity-40"
              title="Save"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
