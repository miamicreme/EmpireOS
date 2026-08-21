-- Repair migration for deployments where 0025_empire_runs.sql was not applied.
-- This migration is intentionally idempotent and safe to run more than once.

create table if not exists public.empire_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id uuid not null,
  conversation_id uuid null,
  status text not null check (status in (
    'understanding','planning','awaiting_approval','executing','verifying',
    'completed','needs_input','failed','cancelled'
  )),
  intent text not null,
  request_summary text not null,
  response_message text null,
  next_best_question text null,
  operation_receipt_ids uuid[] not null default '{}',
  safe_result jsonb not null default '{}'::jsonb,
  error_code text null,
  error_message text null,
  cancel_requested_at timestamptz null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists empire_runs_user_created_idx
  on public.empire_runs(user_id, created_at desc);
create index if not exists empire_runs_trace_idx
  on public.empire_runs(trace_id);
create index if not exists empire_runs_user_status_idx
  on public.empire_runs(user_id, status);

alter table public.empire_runs enable row level security;

drop policy if exists "owner reads empire runs" on public.empire_runs;
create policy "owner reads empire runs" on public.empire_runs
  for select using ((select auth.uid()) = user_id);

drop policy if exists "owner creates empire runs" on public.empire_runs;
create policy "owner creates empire runs" on public.empire_runs
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "owner updates empire runs" on public.empire_runs;
create policy "owner updates empire runs" on public.empire_runs
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.empire_runs to authenticated;
grant all on public.empire_runs to service_role;

comment on table public.empire_runs is
  'Owner-scoped durable lifecycle records for authoritative Empire requests. Raw prompts and chain-of-thought are not stored.';

notify pgrst, 'reload schema';
