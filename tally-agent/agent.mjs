// MNG Tally agent. Runs on the client's Tally server.
//
//   node agent.mjs doctor        check Tally + MNG connectivity; prints counts only
//   node agent.mjs sync          incremental sync (or full, when one is due)
//   node agent.mjs sync --full   force a full sync
//
// Config: config.json next to this file (see config.example.json), or env
// vars MNG_URL, TALLY_SYNC_SECRET, TALLY_URL, TALLY_COMPANY.

import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMng } from "./lib/mng.mjs";
import { addDays, createTally, normalizeVoucher } from "./lib/tally.mjs";

const VERSION = "0.2.0";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, "state.json");
const LOG_FILE = path.join(DIR, "agent.log");

const [command = "help", ...flags] = process.argv.slice(2);

// --- Config, state, logging ---------------------------------------------------

function loadConfig() {
  const file = path.join(DIR, "config.json");
  const json = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  return {
    mngUrl: process.env.MNG_URL || json.mngUrl || "",
    syncSecret: process.env.TALLY_SYNC_SECRET || json.syncSecret || "",
    tallyUrl: process.env.TALLY_URL || json.tallyUrl || "http://localhost:9000",
    company: process.env.TALLY_COMPANY || json.company || "",
    fullSyncEveryHours: Number(json.fullSyncEveryHours) || 24,
  };
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > 5_000_000) {
      renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Logging must never break a sync.
  }
}

// --- Shared helpers --------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

/** Pick the configured company, or the only one open in Tally. */
async function resolveCompany(tally, configured) {
  const companies = await tally.companies();
  if (companies.length === 0) {
    throw new Error("Tally is running but no company is open. Open the company in TallyPrime.");
  }
  if (configured) {
    const match = companies.find((c) => c.name.toLowerCase() === configured.toLowerCase());
    if (!match) {
      throw new Error(
        `Company "${configured}" is not open in Tally. Open companies: ${companies.map((c) => c.name).join(", ")}`
      );
    }
    return match;
  }
  if (companies.length > 1) {
    throw new Error(
      `Several companies are open (${companies.map((c) => c.name).join(", ")}). ` +
        `Set "company" in config.json to the one MNG should sync.`
    );
  }
  return companies[0];
}

/** Ledger name → GUID (exact, plus a lowercase fallback). */
function ledgerIndex(ledgers) {
  const map = new Map();
  for (const l of ledgers) {
    map.set(l.name, l.guid);
    if (!map.has(l.name.toLowerCase())) map.set(l.name.toLowerCase(), l.guid);
  }
  return map;
}

/** [from, to] month windows covering the range, so no single export is huge. */
function monthWindows(from, to) {
  const out = [];
  let start = from;
  while (start <= to) {
    const d = new Date(`${start}T00:00:00Z`);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
    out.push([start, end < to ? end : to]);
    start = addDays(end, 1);
  }
  return out;
}

// --- Commands ------------------------------------------------------------------------

async function sync() {
  const config = loadConfig();
  if (!config.mngUrl || !config.syncSecret) {
    throw new Error("mngUrl and syncSecret must be set in config.json.");
  }
  const tally = createTally(config.tallyUrl);
  const mng = createMng(config);
  const state = loadState();

  const company = await resolveCompany(tally, config.company);
  if (state.company && state.company !== company.name) {
    log(`Company changed from "${state.company}" to "${company.name}"; doing a full sync.`);
  }
  const fullDue =
    flags.includes("--full") ||
    state.company !== company.name ||
    state.lastAlterId == null ||
    !state.lastFullAt ||
    Date.now() - Date.parse(state.lastFullAt) > config.fullSyncEveryHours * 3_600_000;
  const kind = fullDue ? "full" : "incremental";

  const started = Date.now();
  const runId = await mng.start(kind, company.name, VERSION);
  log(`Run ${runId}: ${kind} sync of "${company.name}"`);

  const counts = { ledgers: 0, vouchers: 0, vouchers_skipped: 0 };
  try {
    const ledgers = await tally.debtorLedgers(company.name, today());
    counts.ledgers = await mng.ledgers(runId, ledgers);
    log(`  ${counts.ledgers} debtor ledgers`);
    const index = ledgerIndex(ledgers);

    const booksFrom = company.booksFrom || "2000-04-01";
    const horizon = addDays(today(), 366); // post-dated vouchers
    const windows = fullDue ? monthWindows(booksFrom, horizon) : [[booksFrom, horizon]];
    const afterAlterId = fullDue ? null : state.lastAlterId;
    let maxAlterId = state.lastAlterId ?? 0;

    for (const [from, to] of windows) {
      const nodes = await tally.vouchers(company.name, from, to, afterAlterId);
      const rows = [];
      for (const node of nodes) {
        const v = normalizeVoucher(node, index, { keepEmpty: !fullDue });
        if (v?.alter_id != null) maxAlterId = Math.max(maxAlterId, v.alter_id);
        if (v && v.guid && v.date) rows.push(v);
        else counts.vouchers_skipped++;
      }
      if (rows.length) {
        counts.vouchers += await mng.vouchers(runId, rows);
        if (fullDue) log(`  ${from.slice(0, 7)}: ${rows.length} vouchers`);
      }
    }
    log(`  ${counts.vouchers} vouchers with debtor entries (${counts.vouchers_skipped} others skipped)`);

    counts.seconds = Math.round((Date.now() - started) / 1000);
    const result = await mng.finish(runId, "success", counts);
    saveState({
      ...state,
      company: company.name,
      lastAlterId: maxAlterId,
      lastRunAt: new Date().toISOString(),
      ...(fullDue ? { lastFullAt: new Date().toISOString() } : {}),
    });
    log(
      `Run ${runId}: done in ${counts.seconds}s` +
        (fullDue ? `; removed ${result.vouchers_removed ?? 0} vouchers deleted in Tally` : "")
    );
  } catch (err) {
    await mng.finish(runId, "failed", counts, String(err.message || err)).catch(() => {});
    throw err;
  }
}

/** Connectivity + data-shape check. Prints counts only — no party names or amounts per party. */
async function doctor() {
  const config = loadConfig();
  const ok = (m) => console.log(`  OK    ${m}`);
  const warn = (m) => console.log(`  WARN  ${m}`);
  const fail = (m) => console.log(`  FAIL  ${m}`);
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
  let failures = 0;

  console.log(`MNG Tally agent ${VERSION} — doctor (Node ${process.version})\n`);

  console.log("Tally");
  const tally = createTally(config.tallyUrl, { timeoutMs: 120_000 });
  try {
    const company = await resolveCompany(tally, config.company);
    ok(`Connected to ${config.tallyUrl}; company open, books from ${company.booksFrom ?? "unknown"}`);

    const ledgers = await tally.debtorLedgers(company.name, today());
    const n = ledgers.length;
    const totalDr = ledgers.reduce((s, l) => s + (l.closing_balance ?? 0), 0);
    (n ? ok : fail)(`${n} debtor ledgers (Sundry Debtors). Total closing balance: ${totalDr.toFixed(2)} (positive = receivable)`);
    if (!n) failures++;
    const have = (f) => ledgers.filter(f).length;
    console.log(
      `        fields present: GUID ${pct(have((l) => l.guid), n)}, mobile/phone ${pct(have((l) => l.phone), n)}, ` +
        `email ${pct(have((l) => l.email), n)}, GSTIN ${pct(have((l) => l.gstin), n)}, ` +
        `credit period ${pct(have((l) => l.credit_period_days != null), n)}, ` +
        `opening bills ${have((l) => l.opening_bills.length)} ledgers`
    );

    const from = addDays(today(), -30);
    const nodes = await tally.vouchers(company.name, from, today());
    const index = ledgerIndex(ledgers);
    const vouchers = nodes.map((v) => normalizeVoucher(v, index)).filter(Boolean);
    const withBills = vouchers.filter((v) => v.bills.length).length;
    const types = new Map();
    for (const v of vouchers) types.set(v.voucher_type, (types.get(v.voucher_type) ?? 0) + 1);
    (nodes.length ? ok : warn)(
      `${nodes.length} vouchers in the last 30 days; ${vouchers.length} touch a debtor; ` +
        `${pct(withBills, vouchers.length)} of those have bill-wise details`
    );
    if (vouchers.length) {
      console.log(`        by type: ${[...types].map(([t, c]) => `${t} ${c}`).join(", ")}`);
      const missing = vouchers.filter((v) => !v.guid || !v.date || v.alter_id == null).length;
      (missing ? warn : ok)(`${missing} debtor vouchers missing GUID/date/AlterID`);
    }
    if (nodes.length && !vouchers.length) {
      warn("Vouchers exist but none matched a debtor ledger. Send this output to the developer.");
    }
  } catch (err) {
    failures++;
    fail(err.message);
  }

  console.log("\nMNG");
  if (!config.mngUrl || !config.syncSecret) {
    failures++;
    fail("mngUrl / syncSecret not set in config.json");
  } else {
    try {
      const res = await createMng({ ...config, retries: 0 }).ping();
      ok(`Reached ${config.mngUrl}; signature accepted${res.lastRun ? `; last sync ${res.lastRun.status} at ${res.lastRun.started_at}` : ""}`);
    } catch (err) {
      failures++;
      fail(err.message);
    }
  }

  console.log(failures ? `\n${failures} problem(s) found.` : "\nAll checks passed.");
  process.exitCode = failures ? 1 : 0;
}

// --- Entry ----------------------------------------------------------------------------

const commands = { sync, doctor };
if (!commands[command]) {
  console.log("Usage: node agent.mjs doctor | sync [--full]");
  process.exit(command === "help" ? 0 : 1);
}
commands[command]().catch((err) => {
  log(`ERROR ${err.message || err}`);
  process.exit(1);
});
