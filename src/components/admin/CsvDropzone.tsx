"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";

export default function CsvDropzone({
  onFile,
  filename,
}: {
  onFile: (file: File) => void;
  filename?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
        dragOver
          ? "border-brand-navy bg-brand-navy/5"
          : "border-slate-300 bg-white hover:border-brand-navy/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {filename ? (
        <div className="flex flex-col items-center gap-2 text-brand-slate">
          <FileSpreadsheet className="w-8 h-8 text-brand-navy" />
          <div className="font-medium">{filename}</div>
          <div className="text-xs text-slate-500">
            Click to replace with a different sales report
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="w-9 h-9 text-brand-navy" />
          <div className="font-medium text-brand-slate">
            Drop the “Sales Report — Detailed” CSV here
          </div>
          <div className="text-xs text-slate-500">
            or click to browse · grouped per party automatically
          </div>
        </div>
      )}
    </div>
  );
}
