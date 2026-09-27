"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Eye,
  EyeOff,
  ImageIcon,
} from "lucide-react";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "image";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  half?: boolean; // render at half width in the grid
}

export interface CrudConfig {
  title: string;
  description?: string;
  endpoint: string;
  collectionKey: string; // response array key, e.g. "brands"
  itemKey: string; // single-item key, e.g. "brand"
  fields: FieldSpec[];
  titleField: string;
  subtitleField?: string;
  imageField?: string; // e.g. "image_url"
  addLabel?: string;
}

type Item = Record<string, unknown> & { id: string };

export default function CrudManager({ config }: { config: CrudConfig }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(config.endpoint);
    if (res.ok) {
      const data = await res.json();
      setItems(data[config.collectionKey] ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.endpoint]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    const res = await fetch(`${config.endpoint}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    else alert("Delete failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-slate">
            {config.title}
          </h2>
          {config.description && (
            <p className="text-sm text-slate-500">{config.description}</p>
          )}
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 bg-brand-navy hover:bg-brand-navy-700 text-white rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {config.addLabel ?? "Add"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          Nothing here yet. Click “{config.addLabel ?? "Add"}” to create the
          first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 flex gap-3"
            >
              {config.imageField &&
                (item[config.imageField] ? (
                  <Image
                    src={String(item[config.imageField])}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                  </div>
                ))}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-brand-slate truncate">
                    {String(item[config.titleField] ?? "Untitled")}
                  </span>
                  {"is_visible" in item &&
                    (item.is_visible ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                    ))}
                </div>
                {config.subtitleField && (
                  <div className="text-xs text-slate-500 truncate">
                    {String(item[config.subtitleField] ?? "")}
                  </div>
                )}
              </div>
              <div className="flex items-start gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditing(item);
                    setShowForm(true);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <EntityForm
          config={config}
          item={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setItems((prev) => {
              const exists = prev.some((i) => i.id === saved.id);
              return exists
                ? prev.map((i) => (i.id === saved.id ? saved : i))
                : [...prev, saved];
            });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function EntityForm({
  config,
  item,
  onClose,
  onSaved,
}: {
  config: CrudConfig;
  item: Item | null;
  onClose: () => void;
  onSaved: (item: Item) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of config.fields) {
      if (f.type === "checkbox")
        init[f.name] = item ? Boolean(item[f.name]) : true;
      else if (f.type === "image") continue;
      else init[f.name] = item?.[f.name] != null ? String(item[f.name]) : "";
    }
    return init;
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      if (item) fd.append("id", item.id);
      for (const f of config.fields) {
        if (f.type === "image") continue;
        const v = values[f.name];
        fd.append(f.name, typeof v === "boolean" ? String(v) : v ?? "");
      }
      if (file) fd.append("image", file);

      const res = await fetch(config.endpoint, {
        method: item ? "PATCH" : "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data[config.itemKey]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <div className="text-sm font-semibold text-brand-slate">
            {item ? "Edit" : "New"} · {config.title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3">
          {config.fields.map((f) => {
            if (f.type === "checkbox") {
              return (
                <label
                  key={f.name}
                  className="col-span-2 flex items-center gap-2 text-sm text-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.name])}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  {f.label}
                </label>
              );
            }
            if (f.type === "image") {
              return (
                <div key={f.name} className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {f.label}
                  </label>
                  {Boolean(item?.[config.imageField ?? "image_url"]) && !file && (
                    <div className="mb-2 text-xs text-slate-400">
                      Current image kept unless you choose a new one.
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-navy file:text-white file:px-3 file:py-1.5 file:text-sm"
                  />
                </div>
              );
            }
            return (
              <div
                key={f.name}
                className={f.half ? "col-span-1" : "col-span-2"}
              >
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {f.label}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={String(values[f.name] ?? "")}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    step="any"
                    value={String(values[f.name] ?? "")}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  />
                )}
              </div>
            );
          })}
          {error && (
            <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand-navy hover:bg-brand-navy-700 text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
