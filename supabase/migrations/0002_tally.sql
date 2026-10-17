-- ============================================================================
-- MN Garments — Tally Prime sync (phase 2)
-- Run in the Supabase SQL editor after 0001_init.sql. Safe to re-run.
--
-- The sync agent on the client's Tally server pushes data to
-- POST /api/tally/ingest, which calls the tally_ingest_* functions below with
-- the service-role key. Nothing here is readable or callable with the anon key:
--   * tables have RLS on and no policies;
--   * views are security_invoker, so they inherit that RLS;
--   * functions have EXECUTE revoked from public/anon/authenticated.
--
-- Sign convention: every amount is stored as +Dr / −Cr from MN Garments' side,
-- so a positive party balance means the party owes us. (Tally's XML uses the
-- opposite sign; the agent flips it before sending.)
-- ============================================================================

create table if not exists tally_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('incremental', 'full')),
  company       text,
  agent_version text,
  status        text not null default 'running',  -- running | success | failed
  counts        jsonb not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists tally_sync_runs_started_idx on tally_sync_runs (started_at desc);

-- Debtor ledgers (Sundry Debtors and its subgroups). Full snapshot every run.
create table if not exists tally_ledgers (
  guid               text primary key,
  name               text not null,
  parent_group       text,
  opening_balance    numeric not null default 0,
  closing_balance    numeric,
  credit_period_days int,
  phone              text,
  email              text,
  gstin              text,
  alter_id           bigint,
  is_deleted         boolean not null default false,
  last_seen_run      uuid,
  synced_at          timestamptz not null default now()
);
create index if not exists tally_ledgers_name_idx on tally_ledgers (lower(name));

-- Bills carried in as opening balances on the ledger master (bill-wise details).
create table if not exists tally_opening_bills (
  ledger_guid text not null references tally_ledgers (guid) on delete cascade,
  bill_name   text not null,
  bill_date   date,
  due_date    date,
  amount      numeric not null,
  primary key (ledger_guid, bill_name)
);

create table if not exists tally_vouchers (
  guid           text primary key,
  alter_id       bigint,
  date           date not null,
  voucher_number text,
  voucher_type   text,
  narration      text,
  reference      text,
  is_cancelled   boolean not null default false,
  is_optional    boolean not null default false,
  is_deleted     boolean not null default false,
  last_seen_run  uuid,
  synced_at      timestamptz not null default now()
);
create index if not exists tally_vouchers_date_idx  on tally_vouchers (date);
create index if not exists tally_vouchers_alter_idx on tally_vouchers (alter_id);

-- The debtor side of each voucher, one row per (voucher, debtor ledger).
create table if not exists tally_voucher_lines (
  voucher_guid text not null references tally_vouchers (guid) on delete cascade,
  ledger_guid  text not null,
  amount       numeric not null,
  primary key (voucher_guid, ledger_guid)
);
create index if not exists tally_voucher_lines_ledger_idx on tally_voucher_lines (ledger_guid);

-- Bill-wise allocations on those lines (New Ref / Agst Ref / Advance / On Account).
create table if not exists tally_bill_allocations (
  voucher_guid text not null references tally_vouchers (guid) on delete cascade,
  ledger_guid  text not null,
  bill_name    text not null,
  bill_type    text,
  amount       numeric not null,
  due_date     date,
  primary key (voucher_guid, ledger_guid, bill_name)
);
create index if not exists tally_bill_allocations_bill_idx
  on tally_bill_allocations (ledger_guid, bill_name);

alter table tally_sync_runs        enable row level security;
alter table tally_ledgers          enable row level security;
alter table tally_opening_bills    enable row level security;
alter table tally_vouchers         enable row level security;
alter table tally_voucher_lines    enable row level security;
alter table tally_bill_allocations enable row level security;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Vouchers that count towards balances.
create or replace view v_tally_live_vouchers with (security_invoker = true) as
  select * from tally_vouchers
  where not is_deleted and not is_cancelled and not is_optional;

-- Outstanding bills per party: opening bills + every allocation against them.
-- pending_amount > 0 is receivable; < 0 is an unadjusted advance/on-account credit.
create or replace view v_tally_bills with (security_invoker = true) as
with alloc as (
  select ob.ledger_guid, ob.bill_name, ob.bill_date, ob.due_date, ob.amount
  from tally_opening_bills ob
  union all
  select a.ledger_guid,
         a.bill_name,
         case when a.bill_type in ('New Ref', 'Advance') then v.date end,
         case when a.bill_type in ('New Ref', 'Advance') then a.due_date end,
         a.amount
  from tally_bill_allocations a
  join v_tally_live_vouchers v on v.guid = a.voucher_guid
),
bills as (
  select ledger_guid,
         bill_name,
         min(bill_date)                          as bill_date,
         min(due_date)                           as due_date,
         coalesce(sum(amount) filter (where amount > 0), 0) as billed_amount,
         sum(amount)                             as pending_amount
  from alloc
  group by ledger_guid, bill_name
  having abs(sum(amount)) >= 0.005
)
select b.ledger_guid,
       b.bill_name,
       b.bill_date,
       coalesce(b.due_date, b.bill_date + coalesce(l.credit_period_days, 0)) as due_date,
       b.billed_amount,
       b.pending_amount,
       (now() at time zone 'Asia/Kolkata')::date
         - coalesce(b.due_date, b.bill_date + coalesce(l.credit_period_days, 0)) as days_overdue
from bills b
join tally_ledgers l on l.guid = b.ledger_guid and not l.is_deleted;

-- One row per party, for the control-panel list.
-- computed_balance is rebuilt from synced vouchers; it should equal Tally's
-- closing_balance. A mismatch means the sync is missing or misreading data.
create or replace view v_tally_party_outstanding with (security_invoker = true) as
with line_totals as (
  select vl.ledger_guid, sum(vl.amount) as total, max(v.date) as last_voucher_date
  from tally_voucher_lines vl
  join v_tally_live_vouchers v on v.guid = vl.voucher_guid
  group by vl.ledger_guid
),
bill_totals as (
  select ledger_guid,
         count(*) filter (where pending_amount > 0)                              as open_bills,
         coalesce(sum(pending_amount) filter (where pending_amount > 0), 0)      as bills_pending,
         coalesce(sum(pending_amount) filter (where pending_amount < 0), 0)      as unadjusted_credit,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue > 0), 0) as overdue,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue <= 0), 0) as not_due,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue between 1 and 30), 0)  as age_1_30,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue between 31 and 60), 0) as age_31_60,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue between 61 and 90), 0) as age_61_90,
         coalesce(sum(pending_amount) filter (where pending_amount > 0 and days_overdue > 90), 0)              as age_90_plus,
         min(due_date) filter (where pending_amount > 0)                         as oldest_due_date
  from v_tally_bills
  group by ledger_guid
)
select l.guid,
       l.name,
       l.parent_group,
       l.phone,
       l.email,
       l.gstin,
       l.credit_period_days,
       l.closing_balance,
       l.opening_balance + coalesce(lt.total, 0) as computed_balance,
       lt.last_voucher_date,
       coalesce(bt.open_bills, 0)        as open_bills,
       coalesce(bt.bills_pending, 0)     as bills_pending,
       coalesce(bt.unadjusted_credit, 0) as unadjusted_credit,
       coalesce(bt.overdue, 0)           as overdue,
       coalesce(bt.not_due, 0)           as not_due,
       coalesce(bt.age_1_30, 0)          as age_1_30,
       coalesce(bt.age_31_60, 0)         as age_31_60,
       coalesce(bt.age_61_90, 0)         as age_61_90,
       coalesce(bt.age_90_plus, 0)       as age_90_plus,
       bt.oldest_due_date,
       l.synced_at
from tally_ledgers l
left join line_totals lt on lt.ledger_guid = l.guid
left join bill_totals bt on bt.ledger_guid = l.guid
where not l.is_deleted;

-- ---------------------------------------------------------------------------
-- Ingest functions (called by /api/tally/ingest with the service role)
-- ---------------------------------------------------------------------------

create or replace function tally_start_run(p_kind text, p_company text, p_agent_version text)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  -- A run that never finished (agent killed, Tally closed) is marked failed.
  update tally_sync_runs
     set status = 'failed', finished_at = now(),
         error = coalesce(error, 'Superseded by a newer run before it finished')
   where status = 'running';

  insert into tally_sync_runs (kind, company, agent_version)
  values (p_kind, p_company, p_agent_version)
  returning id into v_id;
  return v_id;
end $$;

-- p_rows: [{guid, name, parent_group, opening_balance, closing_balance,
--           credit_period_days, phone, email, gstin, alter_id,
--           opening_bills: [{bill_name, bill_date, due_date, amount}]}]
create or replace function tally_ingest_ledgers(p_run uuid, p_rows jsonb)
returns int language plpgsql as $$
begin
  insert into tally_ledgers as t (guid, name, parent_group, opening_balance, closing_balance,
                                  credit_period_days, phone, email, gstin, alter_id,
                                  is_deleted, last_seen_run, synced_at)
  select r.guid, r.name, r.parent_group, coalesce(r.opening_balance, 0), r.closing_balance,
         r.credit_period_days, r.phone, r.email, r.gstin, r.alter_id,
         false, p_run, now()
  from jsonb_to_recordset(p_rows) as r(guid text, name text, parent_group text,
       opening_balance numeric, closing_balance numeric, credit_period_days int,
       phone text, email text, gstin text, alter_id bigint)
  on conflict (guid) do update set
    name = excluded.name, parent_group = excluded.parent_group,
    opening_balance = excluded.opening_balance, closing_balance = excluded.closing_balance,
    credit_period_days = excluded.credit_period_days, phone = excluded.phone,
    email = excluded.email, gstin = excluded.gstin, alter_id = excluded.alter_id,
    is_deleted = false, last_seen_run = p_run, synced_at = now();

  delete from tally_opening_bills
   where ledger_guid in (select r->>'guid' from jsonb_array_elements(p_rows) r);

  insert into tally_opening_bills (ledger_guid, bill_name, bill_date, due_date, amount)
  select r->>'guid', b.bill_name, min(b.bill_date), min(b.due_date), sum(b.amount)
  from jsonb_array_elements(p_rows) r,
       jsonb_to_recordset(coalesce(r->'opening_bills', '[]'::jsonb))
         as b(bill_name text, bill_date date, due_date date, amount numeric)
  group by r->>'guid', b.bill_name;

  return jsonb_array_length(p_rows);
end $$;

-- p_rows: [{guid, alter_id, date, voucher_number, voucher_type, narration,
--           reference, is_cancelled, is_optional,
--           lines: [{ledger_guid, amount}],
--           bills: [{ledger_guid, bill_name, bill_type, amount, due_date}]}]
create or replace function tally_ingest_vouchers(p_run uuid, p_rows jsonb)
returns int language plpgsql as $$
begin
  insert into tally_vouchers as t (guid, alter_id, date, voucher_number, voucher_type, narration,
                                   reference, is_cancelled, is_optional, is_deleted,
                                   last_seen_run, synced_at)
  select r.guid, r.alter_id, r.date, r.voucher_number, r.voucher_type, r.narration,
         r.reference, coalesce(r.is_cancelled, false), coalesce(r.is_optional, false), false,
         p_run, now()
  from jsonb_to_recordset(p_rows) as r(guid text, alter_id bigint, date date,
       voucher_number text, voucher_type text, narration text, reference text,
       is_cancelled boolean, is_optional boolean)
  on conflict (guid) do update set
    alter_id = excluded.alter_id, date = excluded.date,
    voucher_number = excluded.voucher_number, voucher_type = excluded.voucher_type,
    narration = excluded.narration, reference = excluded.reference,
    is_cancelled = excluded.is_cancelled, is_optional = excluded.is_optional,
    is_deleted = false, last_seen_run = p_run, synced_at = now();

  -- Replace the lines and allocations of every voucher in this chunk.
  delete from tally_voucher_lines
   where voucher_guid in (select r->>'guid' from jsonb_array_elements(p_rows) r);
  delete from tally_bill_allocations
   where voucher_guid in (select r->>'guid' from jsonb_array_elements(p_rows) r);

  insert into tally_voucher_lines (voucher_guid, ledger_guid, amount)
  select r->>'guid', x.ledger_guid, sum(x.amount)
  from jsonb_array_elements(p_rows) r,
       jsonb_to_recordset(coalesce(r->'lines', '[]'::jsonb)) as x(ledger_guid text, amount numeric)
  group by r->>'guid', x.ledger_guid;

  insert into tally_bill_allocations (voucher_guid, ledger_guid, bill_name, bill_type, amount, due_date)
  select r->>'guid', x.ledger_guid, x.bill_name, min(x.bill_type), sum(x.amount), min(x.due_date)
  from jsonb_array_elements(p_rows) r,
       jsonb_to_recordset(coalesce(r->'bills', '[]'::jsonb))
         as x(ledger_guid text, bill_name text, bill_type text, amount numeric, due_date date)
  group by r->>'guid', x.ledger_guid, x.bill_name;

  return jsonb_array_length(p_rows);
end $$;

-- Close a run. On success, ledgers not seen in this run were deleted in Tally;
-- on a successful *full* run the same applies to vouchers.
create or replace function tally_finish_run(p_run uuid, p_status text, p_counts jsonb, p_error text)
returns jsonb language plpgsql as $$
declare
  v_kind text;
  v_ledgers int := 0;
  v_vouchers int := 0;
begin
  select kind into v_kind from tally_sync_runs where id = p_run and status = 'running';
  if v_kind is null then
    raise exception 'Sync run % is not running', p_run;
  end if;

  if p_status = 'success' then
    update tally_ledgers set is_deleted = true
     where not is_deleted and last_seen_run is distinct from p_run;
    get diagnostics v_ledgers = row_count;

    if v_kind = 'full' then
      update tally_vouchers set is_deleted = true
       where not is_deleted and last_seen_run is distinct from p_run;
      get diagnostics v_vouchers = row_count;
    end if;
  end if;

  update tally_sync_runs
     set status = p_status,
         counts = coalesce(p_counts, '{}'::jsonb)
                  || jsonb_build_object('ledgers_removed', v_ledgers, 'vouchers_removed', v_vouchers),
         error = p_error,
         finished_at = now()
   where id = p_run;

  return jsonb_build_object('ledgers_removed', v_ledgers, 'vouchers_removed', v_vouchers);
end $$;

revoke all on function tally_start_run(text, text, text)            from public, anon, authenticated;
revoke all on function tally_ingest_ledgers(uuid, jsonb)            from public, anon, authenticated;
revoke all on function tally_ingest_vouchers(uuid, jsonb)           from public, anon, authenticated;
revoke all on function tally_finish_run(uuid, text, jsonb, text)    from public, anon, authenticated;
grant execute on function tally_start_run(text, text, text)         to service_role;
grant execute on function tally_ingest_ledgers(uuid, jsonb)         to service_role;
grant execute on function tally_ingest_vouchers(uuid, jsonb)        to service_role;
grant execute on function tally_finish_run(uuid, text, jsonb, text) to service_role;

revoke all on v_tally_live_vouchers, v_tally_bills, v_tally_party_outstanding from anon, authenticated;
