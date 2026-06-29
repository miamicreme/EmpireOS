-- =============================================================================
-- Empire OS — AI V2 (AI Execution Layer)
-- Migration: 0011_ai_v2
--
-- Adds the AI Chief of Staff layer that sits ON TOP of the Spine. AI never
-- replaces the Spine: it reads context, drafts recommendations and actions,
-- and the user approves drafts before they become real global_actions.
--
-- Tables:
--   ai_context_snapshots  — point-in-time redacted EmpireContext captures
--   ai_briefs             — daily / weekly AI briefs
--   ai_recommendations    — ranked recommendations with accept/dismiss state
--   ai_action_drafts      — proposed actions awaiting user approval
--   ai_conversations      — Ask Empire OS chat threads
--   ai_messages           — messages within a conversation
--   ai_usage_events       — provider/model/token usage telemetry
--
-- Every user-owned table: id uuid pk, user_id uuid not null, created_at,
-- RLS enabled, policies enforcing auth.uid() = user_id.
-- =============================================================================

-- ai_context_snapshots --------------------------------------------------------
create table if not exists public.ai_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_for date not null,
  context jsonb not null default '{}'::jsonb,
  redactions_applied boolean not null default true,
  empire_score integer,
  current_phase text,
  created_at timestamptz not null default now()
);

alter table public.ai_context_snapshots enable row level security;

create policy "ai_context_snapshots select own" on public.ai_context_snapshots
  for select to authenticated using (user_id = auth.uid());
create policy "ai_context_snapshots insert own" on public.ai_context_snapshots
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_context_snapshots delete own" on public.ai_context_snapshots
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_context_snapshots_user_date_idx
  on public.ai_context_snapshots (user_id, captured_for desc);

-- ai_briefs -------------------------------------------------------------------
create table if not exists public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  brief_type text not null default 'daily'
    check (brief_type in ('daily', 'weekly')),
  summary text,
  cash_target numeric,
  recommended_focus text,
  top_actions jsonb not null default '[]'::jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  job_hunt_priority text,
  project_priority text,
  confidence numeric,
  model_name text,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_briefs enable row level security;

create policy "ai_briefs select own" on public.ai_briefs
  for select to authenticated using (user_id = auth.uid());
create policy "ai_briefs insert own" on public.ai_briefs
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_briefs update own" on public.ai_briefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_briefs delete own" on public.ai_briefs
  for delete to authenticated using (user_id = auth.uid());

-- One brief per (user, date, type); re-generation upserts.
create unique index if not exists ai_briefs_user_date_type_key
  on public.ai_briefs (user_id, date, brief_type);

-- ai_recommendations ----------------------------------------------------------
create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'chief_of_staff',
  source_id text,
  recommendation text not null,
  reasoning text,
  confidence numeric,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  upside_level text check (upside_level in ('low', 'medium', 'high')),
  rank integer not null default 0,
  suggested_actions jsonb not null default '[]'::jsonb,
  model_name text,
  provider text,
  accepted_at timestamptz,
  dismissed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_recommendations enable row level security;

create policy "ai_recommendations select own" on public.ai_recommendations
  for select to authenticated using (user_id = auth.uid());
create policy "ai_recommendations insert own" on public.ai_recommendations
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_recommendations update own" on public.ai_recommendations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_recommendations delete own" on public.ai_recommendations
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_recommendations_user_created_idx
  on public.ai_recommendations (user_id, created_at desc);

-- ai_action_drafts ------------------------------------------------------------
-- AI drafts actions here. They become real global_actions ONLY after the user
-- approves (see action-draft.service approveActionDraft).
create table if not exists public.ai_action_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references public.ai_recommendations(id) on delete set null,
  module_id text references public.modules(id),
  title text not null,
  description text,
  category text not null default 'general',
  priority text not null default 'medium',
  due_at timestamptz,
  impact_score integer not null default 5,
  urgency_score integer not null default 5,
  effort_score integer not null default 5,
  confidence_score numeric not null default 0.5,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_action_id uuid references public.global_actions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_action_drafts enable row level security;

create policy "ai_action_drafts select own" on public.ai_action_drafts
  for select to authenticated using (user_id = auth.uid());
create policy "ai_action_drafts insert own" on public.ai_action_drafts
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_action_drafts update own" on public.ai_action_drafts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_action_drafts delete own" on public.ai_action_drafts
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_action_drafts_user_status_idx
  on public.ai_action_drafts (user_id, status, created_at desc);

-- ai_conversations ------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  module_id text references public.modules(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations select own" on public.ai_conversations
  for select to authenticated using (user_id = auth.uid());
create policy "ai_conversations insert own" on public.ai_conversations
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_conversations update own" on public.ai_conversations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_conversations delete own" on public.ai_conversations
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ai_messages -----------------------------------------------------------------
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model_name text,
  provider text,
  redactions_applied boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

create policy "ai_messages select own" on public.ai_messages
  for select to authenticated using (user_id = auth.uid());
create policy "ai_messages insert own" on public.ai_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_messages delete own" on public.ai_messages
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at asc);

-- ai_usage_events -------------------------------------------------------------
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  provider text,
  model_name text,
  input_tokens integer,
  output_tokens integer,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_events enable row level security;

create policy "ai_usage_events select own" on public.ai_usage_events
  for select to authenticated using (user_id = auth.uid());
create policy "ai_usage_events insert own" on public.ai_usage_events
  for insert to authenticated with check (user_id = auth.uid());

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);
