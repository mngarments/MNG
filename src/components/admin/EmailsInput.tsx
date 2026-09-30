"use client";

import { Plus, X } from "lucide-react";

/**
 * Edit a list of email addresses: one input per address, "+ Add email" to
 * append another, × to remove. Always keeps at least one (possibly empty) row.
 */
export default function EmailsInput({
  value,
  onChange,
  inputClassName = "",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  inputClassName?: string;
}) {
  const list = value.length ? value : [""];

  const update = (i: number, v: string) =>
    onChange(list.map((e, j) => (j === i ? v : e)));
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-1">
      {list.map((email, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="email"
            value={email}
            onChange={(e) => update(i, e.target.value)}
            placeholder={i === 0 ? "add email…" : "another email…"}
            className={inputClassName}
          />
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-slate-400 hover:text-red-500 shrink-0"
              title="Remove this email"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ""])}
        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-brand-navy hover:underline"
      >
        <Plus className="w-3 h-3" /> Add email
      </button>
    </div>
  );
}
