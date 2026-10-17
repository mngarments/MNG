# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

MN Garments: a Next.js 16 (App Router) + React 19 + Tailwind v4 + Supabase app with two parts:
- **Public one-pager** (`/`, `src/app/page.tsx`): every section is CRM-editable, so nothing is hardcoded. `src/lib/content.ts` holds `DEFAULT_SETTINGS`/`DEFAULT_SECTIONS` fallbacks, so the page still renders when Supabase isn't configured.
- **Distributor console** (`/admin`): turns a sales-report CSV/XLSX into one billing statement per party and emails them over Gmail SMTP. It also has a website CRM (`/admin/site`), customer management, and delivery/open tracking.

## Commands

```bash
npm run dev     # next dev on :3000 (also regenerates AGENTS.md)
npm run build
npm run lint    # eslint (flat config, eslint-config-next)
npx tsc --noEmit  # type-check; there is no separate script
```

There is no test suite.

## Architecture

**Security model.** The browser never talks to Supabase directly for operational data.
- `lib/supabase/public.ts`: anon-key client, used only to read public site content under RLS.
- `lib/supabase/admin.ts`: service-role client, used in route handlers for every write and for all customer/batch/log data.
- `lib/supabase/env.ts` reads either our variable names or the ones the Supabase↔Vercel integration provisions (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, publishable keys). Always get credentials through these helpers.
- Auth is a homemade HMAC-signed cookie (`mng_session`, 12h) in `lib/auth/session.ts`, checked against `ADMIN_EMAIL`/`ADMIN_PASSWORD`. There is no middleware/proxy. Pages are gated by the `admin/(protected)/layout.tsx` redirect, and **every API route must begin with `const unauthorized = await requireAuth(); if (unauthorized) return unauthorized;`** (`lib/auth/guard.ts`). The exceptions are `track/[id]` (public pixel), `keepalive` (uses `CRON_SECRET` bearer), `tally/ingest` (HMAC-signed, see below) and the `auth/*` routes.

**CRUD route pattern** (`api/brands`, `catalog`, `sister-companies`, `customers`, …): use `readEntityBody(req, NUMERIC, BOOL)` from `lib/apiEntity.ts`. It accepts JSON or multipart, uploads an `image` file to the Supabase `catalog` bucket and sets `image_url`, and coerces types. Then filter fields through a per-route `ALLOWED` whitelist with `pick()`. On the client side, `components/admin/CrudManager.tsx` is the matching generic UI.

**Dispatch pipeline** (`admin/(protected)/page.tsx`):
1. `lib/csv/parseSalesReport.ts` parses the portal's "Sales Report - Detailed" export (CSV or XLSX). Long numeric codes (`CODE_COLUMNS`: Batch Code, HSN, Item Code, …) must stay exact strings. Files that Excel has re-saved come through in scientific notation (`8.90561E+12`), and these are rejected with `CorruptedCodesError` rather than "fixed".
2. `lib/csv/aggregateByParty.ts` groups rows strictly by `Party Code` into `PartyStatement`s. GST is CGST+SGST+IGST. `groupRowsByParty` keeps the raw rows so they can be attached as an .xlsx.
3. **The browser runs the send queue**, not the server. It calls `POST /api/send-email` once per party (each call is short, `maxDuration = 30`) with a pacing countdown between sends (`PacingControls`). Each send is recorded in `email_logs`/`dispatch_batches`, so a refresh can resume without duplicates (`ResumeBanner`). Don't turn this into one long server-side loop, because Vercel function timeouts would break it.
4. `lib/email/buildStatementHtml.ts` and `buildStatementExcel.ts` build the email and its attachment. `lib/email/mailer.ts` sends over Nodemailer/Gmail (`SmtpAuthError` for credential problems). Each email embeds a pixel pointing at `/api/track/[logId]`, which marks the log `opened`. This needs `NEXT_PUBLIC_APP_URL` to be the public URL.

**Customers.** A party can have several emails, stored as a comma-separated list in the single `customers.email` column. Use `lib/emails.ts` (`splitEmails`/`joinEmails`/`findInvalidEmail`) to work with it. `lib/csv/importCustomers.ts` matches party codes loosely when importing a contact sheet and reports which parties are new and which were updated.

**Tally sync** (`tally-agent/`, `api/tally/*`, `admin/(protected)/tally`). The client's Tally Prime runs on their own Windows server, and the developer has no access to it, so the agent is dependency-free Node that the client copies there and runs (`node agent.mjs doctor | tick | sync [--full]`). A Windows task runs `tick` every 5 minutes. Each tick checks in (op `config`) and reads the schedule from `tally_agent_settings`, which the admin edits on the Tally Accounts page; `tally-agent/lib/schedule.mjs` `decide()` then picks between an incremental sync, a full sync, or nothing. The window logic in `lib/tally/schedule.ts` must stay in step with it. All schedule times are IST. The agent reads Tally's XML server on localhost:9000 and **pushes** to `POST /api/tally/ingest`; MNG never calls Tally. Ingest is authenticated by an HMAC over `timestamp.body` with `TALLY_SYNC_SECRET` (`lib/tally/signature.ts` ↔ `tally-agent/lib/mng.mjs`, and the two must match), not by the admin session. Ops run `start → ledgers* → vouchers* → finish` and go to the plpgsql `tally_*` functions in `0002_tally.sql`. Things to keep in mind:
- Amounts are stored as +Dr/−Cr (positive = the party owes us). Tally's XML uses the opposite sign, and `drAmount()` in the agent flips it.
- Vouchers sync incrementally by AlterID. Deletions are only detected by the full sync, which runs daily: anything not seen in a successful full run is soft-deleted.
- Outstanding bills, aging and balances are computed by the `v_tally_bills` and `v_tally_party_outstanding` views, not stored. `computed_balance` should equal Tally's `closing_balance`; the UI flags any mismatch.
- The field names are TallyPrime's documented ones and haven't been checked against the client's data yet. When they're wrong, `doctor` reports missing-field percentages.

**Database.** The schema is in `supabase/migrations/0001_init.sql` (tables, RLS, storage bucket) and `supabase/seed.sql` (idempotent). `0002_tally.sql` adds the Tally tables, views and ingest functions, and `0003_tally_schedule.sql` adds the sync schedule. Every new table, view and function must stay closed to `anon`/`authenticated`: RLS with no policies, `security_invoker` views, and `revoke execute` on functions, because Supabase grants these roles access by default. All migrations are applied by hand in the Supabase SQL editor, with no migration tooling. Shared row types are in `lib/types.ts`.

## Deployment

The app is hosted on Vercel. Pushing to `main` deploys automatically. `vercel.json` defines a daily cron that hits `/api/keepalive` to stop the free-tier Supabase project from pausing (it needs `CRON_SECRET`).
