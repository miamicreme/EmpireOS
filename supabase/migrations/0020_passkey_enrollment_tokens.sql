-- 0020_passkey_enrollment_tokens.sql
-- Short-lived one-time tokens that let a signed-in owner enroll a new device
-- without forcing the new device to already be authenticated.

create table if not exists public.passkey_enrollment_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  label_hint text,
  created_user_agent text,
  created_ip text,
  consumed_user_agent text,
  consumed_ip text
);

create index if not exists passkey_enrollment_tokens_user_id_idx
  on public.passkey_enrollment_tokens (user_id);

create index if not exists passkey_enrollment_tokens_expires_at_idx
  on public.passkey_enrollment_tokens (expires_at);

alter table public.passkey_enrollment_tokens enable row level security;
