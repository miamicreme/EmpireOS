-- =============================================================================
-- Empire OS — Finances module
-- Migration: 0018_finances_module
--
-- Tracks the full financial picture beyond daily gig cash: accounts + balances
-- (net worth = assets - liabilities) and transactions/recurring bills (monthly
-- burn, runway). Every table is user-owned with RLS via (select auth.uid()).
-- =============================================================================
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'checking'
    check (account_type in ('checking','savings','cash','investment','retirement','credit_card','loan','mortgage','other')),
  balance numeric not null default 0,
  is_liability boolean not null default false,
  liquid boolean not null default true,
  institution text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.financial_accounts enable row level security;
create policy "financial_accounts select own" on public.financial_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "financial_accounts insert own" on public.financial_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "financial_accounts update own" on public.financial_accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "financial_accounts delete own" on public.financial_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger set_financial_accounts_updated_at
  before update on public.financial_accounts
  for each row execute function public.set_updated_at();
create index if not exists financial_accounts_user_idx on public.financial_accounts (user_id, created_at desc);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.financial_accounts(id) on delete set null,
  occurred_on date not null default current_date,
  description text not null,
  amount numeric not null default 0,
  kind text not null default 'expense' check (kind in ('income','expense')),
  category text,
  recurring boolean not null default false,
  cadence text not null default 'once'
    check (cadence in ('once','weekly','biweekly','monthly','quarterly','yearly')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.financial_transactions enable row level security;
create policy "financial_transactions select own" on public.financial_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "financial_transactions insert own" on public.financial_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "financial_transactions update own" on public.financial_transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "financial_transactions delete own" on public.financial_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger set_financial_transactions_updated_at
  before update on public.financial_transactions
  for each row execute function public.set_updated_at();
create index if not exists financial_transactions_user_date_idx on public.financial_transactions (user_id, occurred_on desc);
create index if not exists financial_transactions_account_idx on public.financial_transactions (account_id);

-- Register the module so module_id FKs resolve.
insert into public.modules (id, name, slug, description, route, icon, priority) values
  ('finances', 'Finances', 'finances', 'Net worth, accounts, spending, burn, and runway.', '/modules/finances', 'wallet', 15)
on conflict (id) do update set name = excluded.name, description = excluded.description, route = excluded.route, icon = excluded.icon;
