# MN Garments — Distributor Showcase + Billing Dispatch Hub

A Next.js (App Router, TypeScript, Tailwind) app for MN Garments, master apparel
distributor in Ranchi. Two surfaces:

1. **Public one-pager** (`/`) — brand showcase, sister companies, and retailer
   lookbook. **Every section is CRM-editable** — nothing is hardcoded.
2. **Distributor console** (`/admin`) — CSV → per-party billing statements sent
   via Gmail SMTP with a resilient, resumable, Vercel-safe pacing queue, plus a
   full website CRM.

## Stack

Next.js 16 · React 19 · Tailwind v4 · Supabase (Postgres + Storage) ·
Nodemailer (Gmail SMTP) · papaparse · SheetJS · lucide-react.

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your prod URL on Vercel (needed for email open-tracking) |
| `SMTP_USER` / `SMTP_PASS` | A Gmail address + [App Password](https://myaccount.google.com/apppasswords) (2-Step Verification required) |
| `FROM_NAME` | Sender display name |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Console login (default `admin@mngarments.com` / `admin123`) |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 2. Database

In the Supabase SQL editor, run in order:

1. `supabase/migrations/0001_init.sql` — tables, RLS, storage bucket.
2. `supabase/seed.sql` — 49 parties + default website content (idempotent).

### 3. Run

```bash
npm install
npm run dev
```

- Public site: <http://localhost:3000>
- Console: <http://localhost:3000/admin>

## How it works

### Security model
The browser only reads **public content** (site settings, brands, sister
companies, lookbook) with the anon key under RLS. All operational data
(customers, batches, email logs) and every write happen in **server route
handlers** using the service-role key. The console is gated by a signed,
httpOnly session cookie.

### Dispatch pacing engine (Vercel-safe)
Batches of 50–200+ never run as one long serverless loop. The **browser**
orchestrates the queue, calling `POST /api/send-email` once per party
(each returns in <2s), waiting a live countdown between sends
(Conservative 5s / Balanced 3s / Fast 2s). Pause / Resume / Cancel are live.
Every send's status is persisted in `email_logs`, so refreshing or closing the
tab lets you **resume from where you left off** with no duplicate emails.

### Email open tracking
Each statement embeds a 1×1 pixel at `/api/track/[logId]`; when the recipient
opens the email the log flips to `opened`. See who opened what in
**Delivery & Tracking**, and one-click **Send Reminders** to parties whose
statements are unopened after 24h.

### Website CRM
`/admin/site` edits every part of the public page — hero copy, credentials,
brand portfolio, sister companies, lookbook articles (with image upload to
Supabase Storage), contact details, WhatsApp number, and SEO — live.

## Deployment (Vercel)

1. Push to a Git repo and import into Vercel.
2. Add all env vars from `.env.example`.
3. Set `NEXT_PUBLIC_APP_URL` to the production URL so tracking pixels resolve.
