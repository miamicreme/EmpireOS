-- =============================================================================
-- Empire OS — Harden AI Provider key storage
-- Migration: 0013_ai_provider_secrets
--
-- 0012 stored api_key_cipher directly on ai_providers, which authenticated RLS
-- grants the client SELECT on — so a browser with the anon key could read the
-- (encrypted) key material via a direct Supabase query. Move the cipher into a
-- dedicated table with RLS ENABLED and NO policies: the anon/authenticated
-- client can never read a row, and only the service-role admin client (which
-- bypasses RLS) can read/write secrets. Ciphertext never reaches the browser.
-- =============================================================================

create table if not exists public.ai_provider_secrets (
  provider_id uuid primary key references public.ai_providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_cipher text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_provider_secrets enable row level security;
-- Intentionally NO policies: deny-all for client roles; service role only.

create trigger set_ai_provider_secrets_updated_at
  before update on public.ai_provider_secrets
  for each row execute function public.set_updated_at();

create index if not exists ai_provider_secrets_user_idx
  on public.ai_provider_secrets (user_id);

-- Non-secret presence flag so the client can show "has key" without the cipher.
alter table public.ai_providers
  add column if not exists has_own_key boolean not null default false;

-- Migrate any existing ciphers off the client-readable table, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_providers'
      and column_name = 'api_key_cipher'
  ) then
    insert into public.ai_provider_secrets (provider_id, user_id, api_key_cipher)
      select id, user_id, api_key_cipher
      from public.ai_providers
      where api_key_cipher is not null
      on conflict (provider_id) do nothing;

    update public.ai_providers
      set has_own_key = true
      where api_key_cipher is not null;

    alter table public.ai_providers drop column api_key_cipher;
  end if;
end $$;
