-- EmpireOS VNext durable Jarvis runs

create table if not exists public.jarvis_runs (
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

create index if not exists jarvis_runs_user_created_idx
  on public.jarvis_runs(user_id, created_at desc);
create index if not exists jarvis_runs_trace_idx
  on public.jarvis_runs(trace_id);
create index if not exists jarvis_runs_user_status_idx
  on public.jarvis_runs(user_id, status);

alter table public.jarvis_runs enable row level security;

create policy "owner reads jarvis runs" on public.jarvis_runs
  for select using ((select auth.uid()) = user_id);
create policy "owner creates jarvis runs" on public.jarvis_runs
  for insert with check ((select auth.uid()) = user_id);
create policy "owner updates jarvis runs" on public.jarvis_runs
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.jarvis_runs is
  'Owner-scoped durable lifecycle records for authoritative Jarvis requests. Raw prompts and chain-of-thought are not stored.';
