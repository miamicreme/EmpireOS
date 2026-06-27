-- =============================================================================
-- Empire OS — Module System V3
-- Migration: 0007_module_system_v3
--
-- Adds supplementary tables for the credit-funding and acquisitions modules:
--   credit_snapshots, funding_tasks, acquisition_contacts, acquisition_scores
-- =============================================================================

-- credit_snapshots ------------------------------------------------------------
create table if not exists public.credit_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  experian_score integer,
  equifax_score integer,
  transunion_score integer,
  utilization_percent numeric,
  open_disputes integer default 0,
  chex_status text,
  early_warning_status text,
  lexisnexis_status text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_snapshots enable row level security;

create policy "credit_snapshots select own" on public.credit_snapshots
  for select to authenticated using (user_id = auth.uid());
create policy "credit_snapshots insert own" on public.credit_snapshots
  for insert to authenticated with check (user_id = auth.uid());
create policy "credit_snapshots update own" on public.credit_snapshots
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "credit_snapshots delete own" on public.credit_snapshots
  for delete to authenticated using (user_id = auth.uid());

-- funding_tasks ---------------------------------------------------------------
create table if not exists public.funding_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  status text not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.funding_tasks enable row level security;

create policy "funding_tasks select own" on public.funding_tasks
  for select to authenticated using (user_id = auth.uid());
create policy "funding_tasks insert own" on public.funding_tasks
  for insert to authenticated with check (user_id = auth.uid());
create policy "funding_tasks update own" on public.funding_tasks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "funding_tasks delete own" on public.funding_tasks
  for delete to authenticated using (user_id = auth.uid());

create trigger set_funding_tasks_updated_at
  before update on public.funding_tasks
  for each row execute function public.set_updated_at();

-- acquisition_contacts --------------------------------------------------------
create table if not exists public.acquisition_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references public.acquisition_targets(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.acquisition_contacts enable row level security;

create policy "acquisition_contacts select own" on public.acquisition_contacts
  for select to authenticated using (user_id = auth.uid());
create policy "acquisition_contacts insert own" on public.acquisition_contacts
  for insert to authenticated with check (user_id = auth.uid());
create policy "acquisition_contacts update own" on public.acquisition_contacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "acquisition_contacts delete own" on public.acquisition_contacts
  for delete to authenticated using (user_id = auth.uid());

-- acquisition_scores ----------------------------------------------------------
create table if not exists public.acquisition_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references public.acquisition_targets(id) on delete cascade,
  cash_flow_score numeric,
  seller_motivation_score numeric,
  financing_score numeric,
  upside_score numeric,
  risk_score numeric,
  overall_score numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.acquisition_scores enable row level security;

create policy "acquisition_scores select own" on public.acquisition_scores
  for select to authenticated using (user_id = auth.uid());
create policy "acquisition_scores insert own" on public.acquisition_scores
  for insert to authenticated with check (user_id = auth.uid());
create policy "acquisition_scores update own" on public.acquisition_scores
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "acquisition_scores delete own" on public.acquisition_scores
  for delete to authenticated using (user_id = auth.uid());

-- =============================================================================
-- End of migration 0007_module_system_v3
-- =============================================================================
