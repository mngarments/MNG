"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  AlertCircle,
  FileWarning,
  Inbox,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react";
import CsvDropzone from "@/components/admin/CsvDropzone";
import StagingTable, { type SendState } from "@/components/admin/StagingTable";
import PacingControls, {
  type Throttle,
  type QueueState,
} from "@/components/admin/PacingControls";
import QuotaCounter from "@/components/admin/QuotaCounter";
import ResumeBanner from "@/components/admin/ResumeBanner";
import PreviewEmailModal from "@/components/admin/PreviewEmailModal";
import {
  parseSalesReport,
  CsvSchemaError,
  type SalesRow,
} from "@/lib/csv/parseSalesReport";
import { aggregateByParty, groupRowsByParty } from "@/lib/csv/aggregateByParty";
import type { Customer, PartyStatement, StagingRow } from "@/lib/types";
import { inr } from "@/lib/format";

type Filter = "all" | "ready" | "missing" | "sent";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DispatchHubPage() {
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [statements, setStatements] = useState<PartyStatement[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  // Exact CSV rows per party + original column order, for the .xlsx attachment.
  const [rawByParty, setRawByParty] = useState<Record<string, SalesRow[]>>({});
  const [csvFields, setCsvFields] = useState<string[]>([]);

  const [statusMap, setStatusMap] = useState<Record<string, SendState>>({});
  const [queueState, setQueueState] = useState<QueueState>("idle");
  const [throttle, setThrottle] = useState<Throttle>(3);
  const [countdown, setCountdown] = useState(0);
  const [sentToday, setSentToday] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);

  const [resume, setResume] = useState<{
    batchId: string;
    sentPartyCodes: string[];
  } | null>(null);
  const [showResume, setShowResume] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [previewRow, setPreviewRow] = useState<StagingRow | null>(null);

  // Control refs for the async send loop.
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const throttleRef = useRef<Throttle>(3);
  const batchIdRef = useRef<string | null>(null);

  useEffect(() => {
    throttleRef.current = throttle;
  }, [throttle]);

  // Load customer directory + resume state on mount.
  useEffect(() => {
    (async () => {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/batch"),
        ]);
        if (cRes.ok) {
          const { customers: list } = await cRes.json();
          const map: Record<string, Customer> = {};
          for (const c of list as Customer[]) map[c.party_code] = c;
          setCustomers(map);
        }
        if (bRes.ok) {
          const data = await bRes.json();
          setSentToday(data.sentToday ?? 0);
          if (data.batch) {
            setResume({
              batchId: data.batch.id,
              sentPartyCodes: data.sentPartyCodes ?? [],
            });
          }
        }
      } catch {
        /* ignore — surfaced on first action */
      }
    })();
  }, []);

  // Merge statements + directory into staging rows.
  const rows: StagingRow[] = useMemo(() => {
    return statements.map((s) => {
      const cust = customers[s.partyCode];
      const email = cust?.email ?? null;
      return {
        ...s,
        email,
        phone: cust?.phone ?? null,
        hasEmail: Boolean(email),
      };
    });
  }, [statements, customers]);

  const sendable = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.hasEmail &&
          statusMap[r.partyCode] !== "sent" &&
          statusMap[r.partyCode] !== "opened"
      ),
    [rows, statusMap]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.partyName} ${r.partyCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const st = statusMap[r.partyCode];
      if (filter === "ready") return r.hasEmail;
      if (filter === "missing") return !r.hasEmail;
      if (filter === "sent") return st === "sent" || st === "opened";
      return true;
    });
  }, [rows, search, filter, statusMap]);

  const totals = useMemo(() => {
    const grand = statements.reduce((a, s) => a + s.grandTotal, 0);
    const invoices = statements.reduce((a, s) => a + s.invoiceCount, 0);
    const missing = rows.filter((r) => !r.hasEmail).length;
    return { grand, invoices, missing, parties: statements.length };
  }, [statements, rows]);

  const setStatus = useCallback((code: string, state: SendState) => {
    setStatusMap((prev) => ({ ...prev, [code]: state }));
  }, []);

  // ---- CSV handling ----
  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      try {
        const text = await file.text();
        const { rows: parsed, fields } = parseSalesReport(text);
        const agg = aggregateByParty(parsed);
        setStatements(agg);
        setRawByParty(groupRowsByParty(parsed));
        setCsvFields(fields);
        setFilename(file.name);
        setStatusMap({});
        setBatchId(null);
        batchIdRef.current = null;
        // Offer resume if there is an unfinished batch.
        if (resume && resume.sentPartyCodes.length > 0) setShowResume(true);
      } catch (err) {
        setStatements([]);
        setRawByParty({});
        setCsvFields([]);
        setFilename(file.name);
        if (err instanceof CsvSchemaError) setParseError(err.message);
        else
          setParseError(
            err instanceof Error ? err.message : "Could not parse the file."
          );
      }
    },
    [resume]
  );

  // ---- Reset / re-upload a different file ----
  const handleClearFile = useCallback(() => {
    if (runningRef.current || queueState === "running" || queueState === "paused") {
      alert(
        "A dispatch is currently running. Cancel it before choosing a different file."
      );
      return;
    }
    if (
      Object.keys(statusMap).length > 0 &&
      !confirm(
        "Discard the current file and upload a different one? Progress shown here will be cleared (already-sent statements are safe)."
      )
    ) {
      return;
    }
    setStatements([]);
    setRawByParty({});
    setCsvFields([]);
    setFilename(null);
    setParseError(null);
    setStatusMap({});
    setBatchId(null);
    batchIdRef.current = null;
    setSearch("");
    setFilter("all");
  }, [queueState, statusMap]);

  // ---- Inline email save ----
  const handleSaveEmail = useCallback(
    async (partyCode: string, email: string) => {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_code: partyCode,
          party_name: customers[partyCode]?.party_name,
          email,
        }),
      });
      if (res.ok) {
        const { customer } = await res.json();
        setCustomers((prev) => ({ ...prev, [partyCode]: customer }));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Could not save email");
      }
    },
    [customers]
  );

  // ---- Queue engine ----
  async function waitWhilePaused() {
    while (pausedRef.current && !cancelledRef.current) await sleep(200);
  }

  async function countdownDelay(seconds: number) {
    for (let s = seconds; s > 0; s--) {
      if (cancelledRef.current) return;
      setCountdown(s);
      await waitWhilePaused();
      if (cancelledRef.current) return;
      await sleep(1000);
    }
    setCountdown(0);
  }

  async function runQueue(list: StagingRow[]) {
    cancelledRef.current = false;
    pausedRef.current = false;
    setQueueState("running");

    for (let i = 0; i < list.length; i++) {
      if (cancelledRef.current) break;
      await waitWhilePaused();
      if (cancelledRef.current) break;

      const row = list[i];
      setStatus(row.partyCode, "sending");
      setCountdown(0);

      try {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statement: row,
            email: row.email,
            batchId: batchIdRef.current,
            isReminder: false,
            rows: rawByParty[row.partyCode] ?? [],
            fields: csvFields,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.skipped) setStatus(row.partyCode, "skipped");
        else if (res.ok) {
          setStatus(row.partyCode, "sent");
          setSentToday((n) => n + 1);
        } else setStatus(row.partyCode, "failed");
      } catch {
        setStatus(row.partyCode, "failed");
      }

      if (i < list.length - 1 && !cancelledRef.current) {
        await countdownDelay(throttleRef.current);
      }
    }

    setCountdown(0);
    const wasCancelled = cancelledRef.current;
    setQueueState("idle");
    runningRef.current = false;
    if (batchIdRef.current) {
      fetch("/api/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: batchIdRef.current,
          status: wasCancelled ? "cancelled" : "completed",
        }),
      }).catch(() => {});
    }
  }

  async function handleStart() {
    if (runningRef.current || sendable.length === 0) return;
    runningRef.current = true;
    // Fresh batch.
    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: filename,
        source_filename: filename,
        total_parties: sendable.length,
      }),
    });
    const { batch } = await res.json();
    batchIdRef.current = batch.id;
    setBatchId(batch.id);
    runQueue(sendable);
  }

  function handleResumeBatch() {
    if (!resume) return;
    // Pre-mark already-sent parties, continue same batch.
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const code of resume.sentPartyCodes) next[code] = "sent";
      return next;
    });
    batchIdRef.current = resume.batchId;
    setBatchId(resume.batchId);
    setShowResume(false);
    runningRef.current = true;
    const remaining = rows.filter(
      (r) => r.hasEmail && !resume.sentPartyCodes.includes(r.partyCode)
    );
    runQueue(remaining);
  }

  function handlePause() {
    pausedRef.current = true;
    setQueueState("paused");
  }
  function handleResume() {
    pausedRef.current = false;
    setQueueState("running");
  }
  function handleCancel() {
    cancelledRef.current = true;
    pausedRef.current = false;
  }

  const doneCount = useMemo(
    () =>
      Object.values(statusMap).filter(
        (s) => s === "sent" || s === "failed" || s === "skipped" || s === "opened"
      ).length,
    [statusMap]
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-slate">
          Billing Dispatch Hub
        </h1>
        <p className="text-sm text-slate-500">
          Upload the secondary sales report, fill any missing emails, and send
          per-party statements at a safe pace.
        </p>
      </header>

      {statements.length === 0 ? (
        <div className="max-w-2xl">
          <CsvDropzone onFile={handleFile} filename={filename} />
          {parseError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* Left: staging */}
          <div className="space-y-4 min-w-0">
            {/* Loaded-file bar with re-upload */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-5 h-5 shrink-0 text-brand-navy" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-brand-slate">
                    {filename ?? "Sales report loaded"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {totals.parties} part{totals.parties === 1 ? "y" : "ies"} ·{" "}
                    {totals.invoices} invoice{totals.invoices === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <button
                onClick={handleClearFile}
                disabled={queueState === "running" || queueState === "paused"}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-navy/50 hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
                title="Discard this file and upload a different one"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Change file
              </button>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Parties" value={String(totals.parties)} />
              <Tile label="Invoices" value={String(totals.invoices)} />
              <Tile label="Grand Total" value={inr(totals.grand, false)} />
              <Tile
                label="Missing Email"
                value={String(totals.missing)}
                warn={totals.missing > 0}
              />
            </div>

            {showResume && resume && (
              <ResumeBanner
                sentCount={resume.sentPartyCodes.length}
                nextIndex={resume.sentPartyCodes.length}
                onResume={handleResumeBatch}
                onDismiss={() => setShowResume(false)}
              />
            )}

            {/* Search + filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search party name or code…"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              {(["all", "ready", "missing", "sent"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs rounded-lg px-3 py-2 border capitalize transition ${
                    filter === f
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-slate-200 text-slate-600 hover:border-brand-navy/50"
                  }`}
                >
                  {f === "missing" ? "Missing email" : f}
                </button>
              ))}
            </div>

            <StagingTable
              rows={filteredRows}
              statusMap={statusMap}
              onSaveEmail={handleSaveEmail}
              onPreview={setPreviewRow}
            />
          </div>

          {/* Right: controls */}
          <div className="space-y-4">
            <QuotaCounter sentToday={sentToday} />
            <PacingControls
              state={queueState}
              throttle={throttle}
              onThrottle={setThrottle}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              countdown={countdown}
              progress={{ done: doneCount, total: sendable.length + doneCount }}
              readyCount={sendable.length}
              isReminderMode={false}
            />
            {totals.missing > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {totals.missing} part
                {totals.missing === 1 ? "y is" : "ies are"} missing an email and
                will be excluded until you add one.
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              <Inbox className="w-4 h-4 shrink-0 mt-0.5 text-brand-navy" />
              Each statement is sent individually from your browser, so long
              batches never time out. Every email includes an Excel (.xlsx) file
              of that customer&apos;s exact rows. You can pause, resume, or close
              the tab and resume later without duplicate sends.
            </div>
          </div>
        </div>
      )}

      <PreviewEmailModal row={previewRow} onClose={() => setPreviewRow(null)} />
    </div>
  );
}

function Tile({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warn ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${
          warn ? "text-amber-700" : "text-brand-slate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
