-- =============================================================================
-- Empire OS — V3 Compact No-Friction Reasoning Agent
-- Migration: 0014_agent_v3_compact_runtime
--
-- One compact agent runtime on 10 tables. Intermediate work (capability plans,
-- gates, specialist votes, tool runs, source evaluations) is stored as typed
-- rows in agent_run_events — NOT as separate first-class tables. Final outputs
-- are agent_artifacts; approval-ready proposals are agent_action_drafts;
-- approved drafts become Spine global_actions.
--
-- Additive only: V2 ai_* tables are untouched and remain readable. V3 writes
-- new data to agent_* exclusively; V2 concepts are bridged with read adapters.
--
-- Every table is user-owned: RLS enabled, auth.uid() = user_id on all policies.
-- =============================================================================

-- agent_threads ---------------------------------------------------------------
create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  mode text not null default 'general',
  status text not null default 'active'
    check (status in ('active', 'archived')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_threads enable row level security;
create policy "agent_threads select own" on public.agent_threads
  for select to authenticated using (user_id = auth.uid());
create policy "agent_threads insert own" on public.agent_threads
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_threads update own" on public.agent_threads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent_threads delete own" on public.agent_threads
  for delete to authenticated using (user_id = auth.uid());

create trigger set_agent_threads_updated_at
  before update on public.agent_threads
  for each row execute function public.set_updated_at();

create index if not exists agent_threads_user_created_idx
  on public.agent_threads (user_id, created_at desc);

-- agent_runs ------------------------------------------------------------------
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.agent_threads(id) on delete set null,
  idempotency_key text,
  user_command text not null,
  intent text,
  runtime_path text not null default 'standard_path',
  status text not null default 'queued',
  final_summary text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  risk_level text,
  needs_memory boolean not null default false,
  needs_research boolean not null default false,
  needs_approval boolean not null default false,
  cost_estimate numeric,
  latency_ms int,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

alter table public.agent_runs enable row level security;
create policy "agent_runs select own" on public.agent_runs
  for select to authenticated using (user_id = auth.uid());
create policy "agent_runs insert own" on public.agent_runs
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_runs update own" on public.agent_runs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent_runs delete own" on public.agent_runs
  for delete to authenticated using (user_id = auth.uid());

create index if not exists agent_runs_user_created_idx
  on public.agent_runs (user_id, created_at desc);
create index if not exists agent_runs_user_status_idx
  on public.agent_runs (user_id, status);
create index if not exists agent_runs_thread_idx
  on public.agent_runs (thread_id, created_at desc);

-- agent_run_events ------------------------------------------------------------
-- The compact ordered trace. Typed event_type replaces many would-be tables:
-- intent_detected, capability_plan, permission_check, context_built,
-- memory_gate, research_gate, provider_selected, specialist_vote, tool_run,
-- source_evaluated, final_synthesized, action_drafts_created, error.
create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  event_order int not null,
  event_type text not null,
  status text not null default 'complete'
    check (status in ('complete', 'in_progress', 'failed', 'blocked', 'invalid_output')),
  summary text,
  payload jsonb not null default '{}',
  latency_ms int,
  created_at timestamptz not null default now(),
  unique (run_id, event_order)
);

alter table public.agent_run_events enable row level security;
create policy "agent_run_events select own" on public.agent_run_events
  for select to authenticated using (user_id = auth.uid());
create policy "agent_run_events insert own" on public.agent_run_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_run_events delete own" on public.agent_run_events
  for delete to authenticated using (user_id = auth.uid());

create index if not exists agent_run_events_run_idx
  on public.agent_run_events (run_id, event_order asc);
create index if not exists agent_run_events_user_type_idx
  on public.agent_run_events (user_id, event_type, created_at desc);

-- agent_context_packs ---------------------------------------------------------
create table if not exists public.agent_context_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  context_hash text not null,
  context_version text not null default 'v3_compact',
  summary text,
  source_refs jsonb not null default '[]',
  record_refs jsonb not null default '[]',
  redacted_context_json jsonb not null default '{}',
  redaction_summary jsonb not null default '{}',
  token_estimate int,
  created_at timestamptz not null default now()
);

alter table public.agent_context_packs enable row level security;
create policy "agent_context_packs select own" on public.agent_context_packs
  for select to authenticated using (user_id = auth.uid());
create policy "agent_context_packs insert own" on public.agent_context_packs
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_context_packs delete own" on public.agent_context_packs
  for delete to authenticated using (user_id = auth.uid());

-- context_hash drives reuse: same request class + same record versions = reuse.
create index if not exists agent_context_packs_user_hash_idx
  on public.agent_context_packs (user_id, context_hash, created_at desc);

-- agent_artifacts -------------------------------------------------------------
create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  artifact_type text not null,
  title text,
  summary text,
  content_json jsonb not null default '{}',
  source_refs jsonb not null default '[]',
  action_draft_refs jsonb not null default '[]',
  confidence numeric check (confidence >= 0 and confidence <= 1),
  risk_level text,
  status text not null default 'active'
    check (status in ('active', 'archived', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.agent_artifacts enable row level security;
create policy "agent_artifacts select own" on public.agent_artifacts
  for select to authenticated using (user_id = auth.uid());
create policy "agent_artifacts insert own" on public.agent_artifacts
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_artifacts update own" on public.agent_artifacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent_artifacts delete own" on public.agent_artifacts
  for delete to authenticated using (user_id = auth.uid());

create index if not exists agent_artifacts_user_type_idx
  on public.agent_artifacts (user_id, artifact_type, created_at desc);
create index if not exists agent_artifacts_user_created_idx
  on public.agent_artifacts (user_id, created_at desc);
create index if not exists agent_artifacts_run_idx
  on public.agent_artifacts (run_id);

-- agent_action_drafts ---------------------------------------------------------
-- Proposed Spine actions. Approved drafts become real global_actions; the
-- created action id is recorded in created_action_id.
create table if not exists public.agent_action_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  source_artifact_id uuid references public.agent_artifacts(id) on delete set null,
  module_id text references public.modules(id),
  title text not null,
  description text,
  category text not null default 'general',
  priority text not null default 'medium',
  urgency text,
  impact text,
  due_at timestamptz,
  reason text,
  impact_score integer not null default 5,
  urgency_score integer not null default 5,
  effort_score integer not null default 5,
  confidence_score numeric not null default 0.5,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_action_id uuid references public.global_actions(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.agent_action_drafts enable row level security;
create policy "agent_action_drafts select own" on public.agent_action_drafts
  for select to authenticated using (user_id = auth.uid());
create policy "agent_action_drafts insert own" on public.agent_action_drafts
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_action_drafts update own" on public.agent_action_drafts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent_action_drafts delete own" on public.agent_action_drafts
  for delete to authenticated using (user_id = auth.uid());

create index if not exists agent_action_drafts_user_status_idx
  on public.agent_action_drafts (user_id, approval_status, created_at desc);

-- agent_memory_items ----------------------------------------------------------
-- Durable approved memory ONLY. Never store secrets; reference module records
-- instead of duplicating module data here.
create table if not exists public.agent_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null,
  title text,
  content text,
  summary text,
  source text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  metadata jsonb not null default '{}',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_memory_items enable row level security;
create policy "agent_memory_items select own" on public.agent_memory_items
  for select to authenticated using (user_id = auth.uid());
create policy "agent_memory_items insert own" on public.agent_memory_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_memory_items update own" on public.agent_memory_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent_memory_items delete own" on public.agent_memory_items
  for delete to authenticated using (user_id = auth.uid());

create trigger set_agent_memory_items_updated_at
  before update on public.agent_memory_items
  for each row execute function public.set_updated_at();

create index if not exists agent_memory_items_user_type_status_idx
  on public.agent_memory_items (user_id, memory_type, status);

-- agent_sources ---------------------------------------------------------------
create table if not exists public.agent_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  title text,
  url text,
  publisher text,
  excerpt text,
  retrieved_at timestamptz,
  published_at timestamptz,
  credibility_score numeric,
  recency_score numeric,
  relevance_score numeric,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.agent_sources enable row level security;
create policy "agent_sources select own" on public.agent_sources
  for select to authenticated using (user_id = auth.uid());
create policy "agent_sources insert own" on public.agent_sources
  for insert to authenticated with check (user_id = auth.uid());
create policy "agent_sources delete own" on public.agent_sources
  for delete to authenticated using (user_id = auth.uid());

create index if not exists agent_sources_user_created_idx
  on public.agent_sources (user_id, created_at desc);
create index if not exists agent_sources_run_idx
  on public.agent_sources (run_id);

-- agent_provider_runs ---------------------------------------------------------
-- Provider/model cost, latency, fallback, and status. Never store secrets.
create table if not exists public.agent_provider_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  provider text not null,
  model text not null,
  runtime_class text,
  intent text,
  feature text,
  status text not null default 'success'
    check (status in ('success', 'failed', 'timeout', 'fallback', 'stub')),
  latency_ms int,
  input_tokens int,
  output_tokens int,
  cost_estimate numeric,
  error_code text,
  fallback_used boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.agent_provider_runs enable row level security;
create policy "agent_provider_runs select own" on public.agent_provider_runs
  for select to authenticated using (user_id = auth.uid());
create policy "agent_provider_runs insert own" on public.agent_provider_runs
  for insert to authenticated with check (user_id = auth.uid());

create index if not exists agent_provider_runs_user_created_idx
  on public.agent_provider_runs (user_id, created_at desc);
create index if not exists agent_provider_runs_run_idx
  on public.agent_provider_runs (run_id);

-- agent_feedback --------------------------------------------------------------
create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  artifact_id uuid references public.agent_artifacts(id) on delete set null,
  feedback_type text not null,
  rating int,
  comment text,
  suggested_correction text,
  should_save_as_memory boolean not null default false,
  never_suggest_again boolean not null default false,
  needs_research_next_time boolean not null default false,
  status text not null default 'recorded',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.agent_feedback enable row level security;
create policy "agent_feedback select own" on public.agent_feedback
  for select to authenticated using (user_id = auth.uid());
create policy "agent_feedback insert own" on public.agent_feedback
  for insert to authenticated with check (user_id = auth.uid());

create index if not exists agent_feedback_user_created_idx
  on public.agent_feedback (user_id, created_at desc);
create index if not exists agent_feedback_run_idx
  on public.agent_feedback (run_id);
