-- EmpireOS VNext control plane
-- Exact-operation approvals and immutable tool execution receipts.

create table if not exists public.tool_approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id uuid not null,
  run_id uuid null,
  tool_id text not null,
  tool_version text not null,
  input_hash text not null,
  risk_level text not null check (risk_level in ('read','low','medium','high','critical')),
  approval_policy text not null check (approval_policy in ('none','confirm','strong_confirm','manual_only')),
  summary text not null,
  exact_effect text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','used')),
  expires_at timestamptz not null,
  approved_at timestamptz null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists tool_approval_exact_pending_idx
  on public.tool_approval_requests(user_id, tool_id, input_hash)
  where status in ('pending','approved');

create index if not exists tool_approval_user_created_idx
  on public.tool_approval_requests(user_id, created_at desc);

create table if not exists public.tool_run_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trace_id uuid not null,
  run_id uuid null,
  approval_id uuid null references public.tool_approval_requests(id) on delete set null,
  tool_id text not null,
  tool_version text not null,
  module_id text not null,
  input_hash text not null,
  output_hash text null,
  status text not null check (status in ('started','verified','unverified','failed','timed_out')),
  error_code text null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  started_at timestamptz not null,
  completed_at timestamptz null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tool_run_receipts_user_created_idx
  on public.tool_run_receipts(user_id, created_at desc);
create index if not exists tool_run_receipts_trace_idx
  on public.tool_run_receipts(trace_id);

alter table public.tool_approval_requests enable row level security;
alter table public.tool_run_receipts enable row level security;

create policy "owner reads tool approvals" on public.tool_approval_requests
  for select using ((select auth.uid()) = user_id);
create policy "owner creates tool approvals" on public.tool_approval_requests
  for insert with check ((select auth.uid()) = user_id);
create policy "owner updates tool approvals" on public.tool_approval_requests
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "owner reads tool receipts" on public.tool_run_receipts
  for select using ((select auth.uid()) = user_id);
create policy "owner creates tool receipts" on public.tool_run_receipts
  for insert with check ((select auth.uid()) = user_id);
create policy "owner updates tool receipts" on public.tool_run_receipts
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

comment on table public.tool_approval_requests is 'Exact-operation approvals bound to one tool version and one input hash.';
comment on table public.tool_run_receipts is 'Safe, source-content-free execution receipts for governed Jarvis tools.';
