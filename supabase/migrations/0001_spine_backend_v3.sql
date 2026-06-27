-- =============================================================================
-- Empire OS — Backend Spine V3
-- Migration: 0001_spine_backend_v3
--
-- Creates the Spine + Module data layer:
--   Spine tables, Module tables, indexes, updated_at triggers, and Row Level
--   Security on every user-owned table.
--
-- Principles:
--   The Spine owns priority. Modules own detail.
--   Reference tables (empire_phases, modules) are authenticated-readable.
--   User-owned data is isolated by auth.uid() and never visible across users.
-- =============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists pgcrypto;

-- =============================================================================
-- Shared trigger function: maintain updated_at
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- SPINE TABLES
-- =============================================================================

-- profiles --------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  current_phase text default 'phase_0',
  daily_cash_target numeric default 250,
  weekly_cash_target numeric default 1500,
  monthly_cash_target numeric default 6000,
  risk_tolerance text default 'balanced'
    check (risk_tolerance in ('conservative', 'balanced', 'aggressive')),
  primary_goal text default 'Build KJB Empire',
  timezone text default 'America/New_York',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- empire_phases (reference) ---------------------------------------------------
create table if not exists public.empire_phases (
  id text primary key,
  name text not null,
  description text,
  goal text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'complete')),
  priority_order int not null,
  progress numeric default 0,
  created_at timestamptz default now()
);

-- modules (reference) ---------------------------------------------------------
create table if not exists public.modules (
  id text primary key,
  name text not null,
  slug text unique not null,
  description text,
  phase_id text references public.empire_phases(id),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  priority int not null default 100,
  health text default 'yellow'
    check (health in ('green', 'yellow', 'red')),
  route text not null,
  icon text,
  capabilities jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- global_actions --------------------------------------------------------------
create table if not exists public.global_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references public.modules(id),
  phase_id text references public.empire_phases(id),
  title text not null,
  description text,
  category text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'done', 'archived')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  due_at timestamptz,
  completed_at timestamptz,
  impact_score int default 5,
  urgency_score int default 5,
  effort_score int default 5,
  confidence_score numeric default 0.5,
  empire_score_weight numeric default 1,
  rank_score numeric,
  source_type text default 'manual',
  source_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- module_metrics --------------------------------------------------------------
create table if not exists public.module_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references public.modules(id),
  metric_key text not null,
  metric_label text not null,
  metric_value numeric,
  metric_text text,
  target_value numeric,
  unit text,
  date date default current_date,
  trend_direction text
    check (trend_direction is null or trend_direction in ('up', 'down', 'flat')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- decisions -------------------------------------------------------------------
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  question text not null,
  context text,
  status text not null default 'draft'
    check (status in ('draft', 'analyzing', 'decided', 'archived')),
  recommendation text,
  confidence numeric,
  selected_option text,
  risk_level text,
  upside_level text,
  decision_type text default 'general',
  created_at timestamptz default now(),
  decided_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

-- decision_options ------------------------------------------------------------
create table if not exists public.decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  label text not null,
  description text,
  pros jsonb default '[]'::jsonb,
  cons jsonb default '[]'::jsonb,
  estimated_cash_impact numeric,
  estimated_time_hours numeric,
  estimated_risk text,
  metadata jsonb default '{}'::jsonb
);

-- decision_votes --------------------------------------------------------------
create table if not exists public.decision_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  advisor_name text not null,
  advisor_role text not null,
  model_name text,
  recommendation text not null,
  reasoning text,
  confidence numeric,
  risks text,
  next_actions jsonb default '[]'::jsonb,
  redactions_applied boolean default true,
  created_at timestamptz default now()
);

-- daily_reviews ---------------------------------------------------------------
create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  empire_score numeric,
  cash_today numeric,
  wins text,
  blockers text,
  top_actions jsonb default '[]'::jsonb,
  mood text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- weekly_reviews --------------------------------------------------------------
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  empire_score numeric,
  cash_total numeric,
  cash_target numeric,
  highlights text,
  lessons text,
  next_week_focus jsonb default '[]'::jsonb,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, week_start)
);

-- audit_events ----------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- system_events ---------------------------------------------------------------
create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  event_type text not null,
  module_id text references public.modules(id),
  entity_type text,
  entity_id text,
  payload jsonb default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz default now()
);

-- notifications ---------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  notification_type text not null default 'info'
    check (notification_type in ('info', 'success', 'warning', 'urgent')),
  status text not null default 'unread'
    check (status in ('unread', 'read', 'archived')),
  related_entity_type text,
  related_entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- documents -------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references public.modules(id),
  title text not null,
  document_type text,
  storage_path text,
  summary text,
  sensitive boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- MODULE TABLES
-- =============================================================================

-- cash_entries ----------------------------------------------------------------
create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  source text not null,
  gross_amount numeric default 0,
  expenses numeric default 0,
  net_amount numeric generated always as (gross_amount - expenses) stored,
  hours numeric,
  trips int,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- job_applications ------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  salary_min numeric,
  salary_max numeric,
  status text default 'saved'
    check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'accepted')),
  priority_score int default 5,
  recruiter_name text,
  recruiter_email text,
  job_url text,
  resume_version text,
  next_action text,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- contacts --------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  contact_type text not null,
  phone text,
  email text,
  status text default 'active'
    check (status in ('active', 'cold', 'archived')),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  related_module_id text references public.modules(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- projects --------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text default 'active'
    check (status in ('active', 'paused', 'complete', 'archived')),
  focus_level text default 'medium'
    check (focus_level in ('low', 'medium', 'high')),
  revenue_potential numeric,
  strategic_value int default 5,
  next_action text,
  blocker text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- credit_items ----------------------------------------------------------------
create table if not exists public.credit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bureau text,
  item_name text not null,
  item_type text,
  status text default 'open'
    check (status in ('open', 'disputing', 'resolved', 'archived')),
  due_at timestamptz,
  next_action text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- acquisition_targets ---------------------------------------------------------
create table if not exists public.acquisition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_type text not null,
  location text,
  asking_price numeric,
  revenue numeric,
  noi numeric,
  seller_financing_possible boolean default false,
  status text default 'watching'
    check (status in ('watching', 'contacted', 'analyzing', 'offer', 'closed', 'passed')),
  upside_score int default 5,
  risk_score int default 5,
  next_action text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index if not exists idx_global_actions_user on public.global_actions(user_id);
create index if not exists idx_global_actions_module on public.global_actions(module_id);
create index if not exists idx_global_actions_status on public.global_actions(status);
create index if not exists idx_global_actions_due on public.global_actions(due_at);
create index if not exists idx_global_actions_rank on public.global_actions(rank_score desc);

create index if not exists idx_module_metrics_user on public.module_metrics(user_id);
create index if not exists idx_module_metrics_module on public.module_metrics(module_id);
create index if not exists idx_module_metrics_date on public.module_metrics(date);

create index if not exists idx_decisions_user on public.decisions(user_id);
create index if not exists idx_decisions_status on public.decisions(status);
create index if not exists idx_decision_options_decision on public.decision_options(decision_id);
create index if not exists idx_decision_votes_decision on public.decision_votes(decision_id);

create index if not exists idx_daily_reviews_user on public.daily_reviews(user_id);
create index if not exists idx_daily_reviews_date on public.daily_reviews(date);
create index if not exists idx_weekly_reviews_user on public.weekly_reviews(user_id);

create index if not exists idx_audit_events_user on public.audit_events(user_id);
create index if not exists idx_audit_events_entity on public.audit_events(entity_type, entity_id);

create index if not exists idx_system_events_user on public.system_events(user_id);
create index if not exists idx_system_events_module on public.system_events(module_id);
create index if not exists idx_system_events_processed on public.system_events(processed_at);

create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_status on public.notifications(status);

create index if not exists idx_documents_user on public.documents(user_id);
create index if not exists idx_documents_module on public.documents(module_id);

create index if not exists idx_cash_entries_user on public.cash_entries(user_id);
create index if not exists idx_cash_entries_date on public.cash_entries(date);

create index if not exists idx_job_applications_user on public.job_applications(user_id);
create index if not exists idx_job_applications_status on public.job_applications(status);
create index if not exists idx_job_applications_follow_up on public.job_applications(follow_up_at);

create index if not exists idx_contacts_user on public.contacts(user_id);
create index if not exists idx_contacts_follow_up on public.contacts(next_follow_up_at);

create index if not exists idx_projects_user on public.projects(user_id);
create index if not exists idx_projects_status on public.projects(status);

create index if not exists idx_credit_items_user on public.credit_items(user_id);
create index if not exists idx_credit_items_due on public.credit_items(due_at);

create index if not exists idx_acquisition_targets_user on public.acquisition_targets(user_id);
create index if not exists idx_acquisition_targets_status on public.acquisition_targets(status);

-- =============================================================================
-- updated_at TRIGGERS
-- =============================================================================
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_modules_updated before update on public.modules
  for each row execute function public.set_updated_at();
create trigger trg_global_actions_updated before update on public.global_actions
  for each row execute function public.set_updated_at();
create trigger trg_daily_reviews_updated before update on public.daily_reviews
  for each row execute function public.set_updated_at();
create trigger trg_weekly_reviews_updated before update on public.weekly_reviews
  for each row execute function public.set_updated_at();
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();
create trigger trg_cash_entries_updated before update on public.cash_entries
  for each row execute function public.set_updated_at();
create trigger trg_job_applications_updated before update on public.job_applications
  for each row execute function public.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_credit_items_updated before update on public.credit_items
  for each row execute function public.set_updated_at();
create trigger trg_acquisition_targets_updated before update on public.acquisition_targets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Reference tables: authenticated-readable, no write from clients ------------
alter table public.empire_phases enable row level security;
alter table public.modules enable row level security;

create policy "empire_phases readable by authenticated"
  on public.empire_phases for select to authenticated using (true);
create policy "modules readable by authenticated"
  on public.modules for select to authenticated using (true);

-- Helper macro pattern: each user-owned table gets 4 policies scoped to
-- auth.uid(). Written explicitly per table (no dynamic SQL) for clarity.

-- profiles (id is the user id) ------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles delete own" on public.profiles
  for delete to authenticated using (id = auth.uid());

-- global_actions --------------------------------------------------------------
alter table public.global_actions enable row level security;
create policy "global_actions select own" on public.global_actions
  for select to authenticated using (user_id = auth.uid());
create policy "global_actions insert own" on public.global_actions
  for insert to authenticated with check (user_id = auth.uid());
create policy "global_actions update own" on public.global_actions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "global_actions delete own" on public.global_actions
  for delete to authenticated using (user_id = auth.uid());

-- module_metrics --------------------------------------------------------------
alter table public.module_metrics enable row level security;
create policy "module_metrics select own" on public.module_metrics
  for select to authenticated using (user_id = auth.uid());
create policy "module_metrics insert own" on public.module_metrics
  for insert to authenticated with check (user_id = auth.uid());
create policy "module_metrics update own" on public.module_metrics
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "module_metrics delete own" on public.module_metrics
  for delete to authenticated using (user_id = auth.uid());

-- decisions -------------------------------------------------------------------
alter table public.decisions enable row level security;
create policy "decisions select own" on public.decisions
  for select to authenticated using (user_id = auth.uid());
create policy "decisions insert own" on public.decisions
  for insert to authenticated with check (user_id = auth.uid());
create policy "decisions update own" on public.decisions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decisions delete own" on public.decisions
  for delete to authenticated using (user_id = auth.uid());

-- decision_options (protected through parent decisions.user_id) ----------------
alter table public.decision_options enable row level security;
create policy "decision_options select via parent" on public.decision_options
  for select to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_options.decision_id and d.user_id = auth.uid()));
create policy "decision_options insert via parent" on public.decision_options
  for insert to authenticated with check (exists (
    select 1 from public.decisions d
    where d.id = decision_options.decision_id and d.user_id = auth.uid()));
create policy "decision_options update via parent" on public.decision_options
  for update to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_options.decision_id and d.user_id = auth.uid()))
  with check (exists (
    select 1 from public.decisions d
    where d.id = decision_options.decision_id and d.user_id = auth.uid()));
create policy "decision_options delete via parent" on public.decision_options
  for delete to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_options.decision_id and d.user_id = auth.uid()));

-- decision_votes (protected through parent decisions.user_id) ------------------
alter table public.decision_votes enable row level security;
create policy "decision_votes select via parent" on public.decision_votes
  for select to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_votes.decision_id and d.user_id = auth.uid()));
create policy "decision_votes insert via parent" on public.decision_votes
  for insert to authenticated with check (exists (
    select 1 from public.decisions d
    where d.id = decision_votes.decision_id and d.user_id = auth.uid()));
create policy "decision_votes update via parent" on public.decision_votes
  for update to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_votes.decision_id and d.user_id = auth.uid()))
  with check (exists (
    select 1 from public.decisions d
    where d.id = decision_votes.decision_id and d.user_id = auth.uid()));
create policy "decision_votes delete via parent" on public.decision_votes
  for delete to authenticated using (exists (
    select 1 from public.decisions d
    where d.id = decision_votes.decision_id and d.user_id = auth.uid()));

-- daily_reviews ---------------------------------------------------------------
alter table public.daily_reviews enable row level security;
create policy "daily_reviews select own" on public.daily_reviews
  for select to authenticated using (user_id = auth.uid());
create policy "daily_reviews insert own" on public.daily_reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "daily_reviews update own" on public.daily_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_reviews delete own" on public.daily_reviews
  for delete to authenticated using (user_id = auth.uid());

-- weekly_reviews --------------------------------------------------------------
alter table public.weekly_reviews enable row level security;
create policy "weekly_reviews select own" on public.weekly_reviews
  for select to authenticated using (user_id = auth.uid());
create policy "weekly_reviews insert own" on public.weekly_reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "weekly_reviews update own" on public.weekly_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weekly_reviews delete own" on public.weekly_reviews
  for delete to authenticated using (user_id = auth.uid());

-- audit_events (insert own; read own; immutable: no update/delete) ------------
alter table public.audit_events enable row level security;
create policy "audit_events select own" on public.audit_events
  for select to authenticated using (user_id = auth.uid());
create policy "audit_events insert own" on public.audit_events
  for insert to authenticated with check (user_id = auth.uid());

-- system_events ---------------------------------------------------------------
alter table public.system_events enable row level security;
create policy "system_events select own" on public.system_events
  for select to authenticated using (user_id = auth.uid());
create policy "system_events insert own" on public.system_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "system_events update own" on public.system_events
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "system_events delete own" on public.system_events
  for delete to authenticated using (user_id = auth.uid());

-- notifications ---------------------------------------------------------------
alter table public.notifications enable row level security;
create policy "notifications select own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications insert own" on public.notifications
  for insert to authenticated with check (user_id = auth.uid());
create policy "notifications update own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications delete own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- documents -------------------------------------------------------------------
alter table public.documents enable row level security;
create policy "documents select own" on public.documents
  for select to authenticated using (user_id = auth.uid());
create policy "documents insert own" on public.documents
  for insert to authenticated with check (user_id = auth.uid());
create policy "documents update own" on public.documents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "documents delete own" on public.documents
  for delete to authenticated using (user_id = auth.uid());

-- cash_entries ----------------------------------------------------------------
alter table public.cash_entries enable row level security;
create policy "cash_entries select own" on public.cash_entries
  for select to authenticated using (user_id = auth.uid());
create policy "cash_entries insert own" on public.cash_entries
  for insert to authenticated with check (user_id = auth.uid());
create policy "cash_entries update own" on public.cash_entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cash_entries delete own" on public.cash_entries
  for delete to authenticated using (user_id = auth.uid());

-- job_applications ------------------------------------------------------------
alter table public.job_applications enable row level security;
create policy "job_applications select own" on public.job_applications
  for select to authenticated using (user_id = auth.uid());
create policy "job_applications insert own" on public.job_applications
  for insert to authenticated with check (user_id = auth.uid());
create policy "job_applications update own" on public.job_applications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "job_applications delete own" on public.job_applications
  for delete to authenticated using (user_id = auth.uid());

-- contacts --------------------------------------------------------------------
alter table public.contacts enable row level security;
create policy "contacts select own" on public.contacts
  for select to authenticated using (user_id = auth.uid());
create policy "contacts insert own" on public.contacts
  for insert to authenticated with check (user_id = auth.uid());
create policy "contacts update own" on public.contacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "contacts delete own" on public.contacts
  for delete to authenticated using (user_id = auth.uid());

-- projects --------------------------------------------------------------------
alter table public.projects enable row level security;
create policy "projects select own" on public.projects
  for select to authenticated using (user_id = auth.uid());
create policy "projects insert own" on public.projects
  for insert to authenticated with check (user_id = auth.uid());
create policy "projects update own" on public.projects
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects delete own" on public.projects
  for delete to authenticated using (user_id = auth.uid());

-- credit_items ----------------------------------------------------------------
alter table public.credit_items enable row level security;
create policy "credit_items select own" on public.credit_items
  for select to authenticated using (user_id = auth.uid());
create policy "credit_items insert own" on public.credit_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "credit_items update own" on public.credit_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "credit_items delete own" on public.credit_items
  for delete to authenticated using (user_id = auth.uid());

-- acquisition_targets ---------------------------------------------------------
alter table public.acquisition_targets enable row level security;
create policy "acquisition_targets select own" on public.acquisition_targets
  for select to authenticated using (user_id = auth.uid());
create policy "acquisition_targets insert own" on public.acquisition_targets
  for insert to authenticated with check (user_id = auth.uid());
create policy "acquisition_targets update own" on public.acquisition_targets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "acquisition_targets delete own" on public.acquisition_targets
  for delete to authenticated using (user_id = auth.uid());

-- =============================================================================
-- End of migration 0001_spine_backend_v3
-- =============================================================================
