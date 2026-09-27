-- ============================================================================
-- MN Garments — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Security model:
--   * The browser only ever talks to Supabase for PUBLIC, read-only content
--     (site_settings, site_sections, brands, sister_companies, catalog_items)
--     using the anon key. Those tables have a public SELECT policy.
--   * Every write, and every read of operational data (customers, batches,
--     email_logs), happens in server route handlers using the SERVICE ROLE key,
--     which bypasses RLS. Those tables therefore expose NO anon policy at all.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Operational tables (server-only; no anon policies)
-- ---------------------------------------------------------------------------

create table if not exists customers (
  party_code  text primary key,
  party_name  text not null,
  gstin       text,
  email       text,
  phone       text,
  updated_at  timestamptz not null default now()
);

create table if not exists dispatch_batches (
  id              uuid primary key default gen_random_uuid(),
  label           text,
  source_filename text,
  total_parties   int not null default 0,
  sent_count      int not null default 0,
  status          text not null default 'active',  -- active | paused | completed | cancelled
  created_at      timestamptz not null default now()
);

create table if not exists email_logs (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid references dispatch_batches(id) on delete set null,
  party_code     text,
  recipient_email text,
  subject        text,
  total_amount   numeric,
  invoice_count  int,
  is_reminder    boolean not null default false,
  status         text not null default 'draft',    -- draft | sent | failed | opened
  error          text,
  sent_at        timestamptz,
  opened_at      timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists email_logs_batch_idx  on email_logs (batch_id);
create index if not exists email_logs_party_idx  on email_logs (party_code);
create index if not exists email_logs_status_idx on email_logs (status);
create index if not exists email_logs_sent_idx   on email_logs (sent_at);

-- ---------------------------------------------------------------------------
-- Public / CRM-editable content tables (public SELECT, server-only writes)
-- ---------------------------------------------------------------------------

-- Global singleton-style key/value settings (brand name, contact, WhatsApp, SEO…).
-- One row per key; value is JSON so the CRM can store scalars, text or arrays.
create table if not exists site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Structured content blocks for each section of the one-pager
-- (hero, credentials, footer, etc.). `data` holds the editable fields.
create table if not exists site_sections (
  key         text primary key,   -- 'hero' | 'credentials' | 'footer' | ...
  title       text,
  data        jsonb not null default '{}'::jsonb,
  is_visible  boolean not null default true,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- Brand portfolio cards (marquee brands MN Garments distributes).
create table if not exists brands (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  tagline        text,
  description    text,
  image_url      text,
  is_ready_stock boolean not null default true,
  is_visible     boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Sister company cards.
create table if not exists sister_companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,               -- e.g. "Corporate Wholesale & C&F"
  description text,
  location    text,
  image_url   text,
  is_visible  boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Retailer lookbook articles.
create table if not exists catalog_items (
  id              uuid primary key default gen_random_uuid(),
  brand           text,
  style_code      text,
  description     text,
  mrp             numeric,
  dealer_net_rate numeric,
  moq             text,
  size_curve      text,
  image_url       text,
  is_ready_stock  boolean not null default true,
  is_visible      boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table customers        enable row level security;
alter table dispatch_batches enable row level security;
alter table email_logs       enable row level security;
alter table site_settings    enable row level security;
alter table site_sections    enable row level security;
alter table brands           enable row level security;
alter table sister_companies enable row level security;
alter table catalog_items    enable row level security;

-- Public read-only policies for the CRM-driven public site.
-- (No policies on customers / dispatch_batches / email_logs => anon blocked;
--  the service role bypasses RLS for all server-side operations.)
drop policy if exists "public read settings"  on site_settings;
drop policy if exists "public read sections"  on site_sections;
drop policy if exists "public read brands"    on brands;
drop policy if exists "public read sisters"   on sister_companies;
drop policy if exists "public read catalog"   on catalog_items;

create policy "public read settings" on site_settings    for select using (true);
create policy "public read sections" on site_sections    for select using (true);
create policy "public read brands"   on brands           for select using (is_visible);
create policy "public read sisters"  on sister_companies for select using (is_visible);
create policy "public read catalog"  on catalog_items    for select using (is_visible);

-- ---------------------------------------------------------------------------
-- Storage bucket for catalog / brand imagery (public read, service-role write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

drop policy if exists "public read catalog images" on storage.objects;
create policy "public read catalog images"
  on storage.objects for select
  using (bucket_id = 'catalog');
