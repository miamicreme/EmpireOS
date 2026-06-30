-- =============================================================================
-- Empire OS — AI Provider Management
-- Migration: 0012_ai_providers
--
-- Lets the operator configure up to 5 LLM providers/models and pick which one
-- the AI layer uses. API keys are stored ENCRYPTED at rest (AES-256-GCM, keyed
-- by a server-only secret) in api_key_cipher and are NEVER returned to the
-- client by the API. A null api_key_cipher means "use the env key for this
-- provider" (bring-your-own-key is optional).
--
-- The 5-provider cap and one-default-per-user invariant are enforced in the
-- service layer; the partial unique index below is the DB backstop for default.
-- =============================================================================

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  model text not null,
  api_key_cipher text,
  api_key_hint text,
  is_default boolean not null default false,
  enabled boolean not null default true,
  rank integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_providers enable row level security;

create policy "ai_providers select own" on public.ai_providers
  for select to authenticated using (user_id = auth.uid());
create policy "ai_providers insert own" on public.ai_providers
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_providers update own" on public.ai_providers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_providers delete own" on public.ai_providers
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_providers_updated_at
  before update on public.ai_providers
  for each row execute function public.set_updated_at();

-- At most one default provider per user.
create unique index if not exists ai_providers_one_default
  on public.ai_providers (user_id) where is_default;

create index if not exists ai_providers_user_rank_idx
  on public.ai_providers (user_id, rank asc, created_at asc);
