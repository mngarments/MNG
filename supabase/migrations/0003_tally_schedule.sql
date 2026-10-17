-- ============================================================================
-- MN Garments — Tally sync schedule, controlled from the admin portal
-- Run in the Supabase SQL editor after 0002_tally.sql. Safe to re-run.
--
-- The agent on the Tally server checks in every 5 minutes (op "config" on
-- /api/tally/ingest), reads this row, and decides whether to sync. All times
-- are India time (IST).
-- ============================================================================

create table if not exists tally_agent_settings (
  id                  int primary key default 1 check (id = 1),  -- single row
  enabled             boolean not null default true,
  interval_minutes    int not null default 15 check (interval_minutes between 5 and 1440),
  active_from         time,              -- incremental syncs only between these
  active_to           time,              -- times (null = all day; may wrap midnight)
  full_sync_time      time not null default '23:00',
  sync_requested_at   timestamptz,       -- "Sync now" from the portal
  sync_requested_full boolean not null default false,
  agent_last_seen_at  timestamptz,
  agent_version       text,
  updated_at          timestamptz not null default now()
);

insert into tally_agent_settings (id) values (1) on conflict (id) do nothing;

alter table tally_agent_settings enable row level security;

-- Starting a run satisfies a pending "Sync now" request (a full run satisfies
-- either kind; an incremental run only a non-full request).
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

  update tally_agent_settings
     set sync_requested_at = null, sync_requested_full = false
   where sync_requested_at is not null
     and (p_kind = 'full' or not sync_requested_full);

  insert into tally_sync_runs (kind, company, agent_version)
  values (p_kind, p_company, p_agent_version)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function tally_start_run(text, text, text) from public, anon, authenticated;
grant execute on function tally_start_run(text, text, text) to service_role;
