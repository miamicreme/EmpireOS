-- 0009_webauthn_credentials.sql
-- Passkey (WebAuthn / FIDO2) credentials for passwordless, biometric login.
--
-- The biometric itself NEVER reaches the server. Each row stores only the
-- public key and metadata for a credential whose private key lives in the
-- user's device secure enclave (unlocked by Face ID / Touch ID / Windows Hello).
-- Users are still real auth.users rows, so RLS (auth.uid()) and every existing
-- foreign key keep working unchanged.

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Base64URL-encoded credential id (the WebAuthn credential identifier).
  credential_id text not null unique,
  -- Base64URL-encoded COSE public key.
  public_key text not null,
  -- Signature counter for clone/replay detection.
  counter bigint not null default 0,
  -- Authenticator transports hint (e.g. {internal,hybrid}).
  transports text[] default '{}',
  device_type text,
  backed_up boolean default false,
  -- Human label so the owner can tell recovery devices apart.
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists webauthn_credentials_user_id_idx
  on public.webauthn_credentials (user_id);

-- RLS: a user may only see and manage their own credentials. Registration,
-- verification, and counter updates happen via the service role (server-side),
-- which bypasses RLS; these policies cover any client-side reads/deletes.
alter table public.webauthn_credentials enable row level security;

create policy "webauthn_credentials select own" on public.webauthn_credentials
  for select to authenticated using (user_id = auth.uid());
create policy "webauthn_credentials insert own" on public.webauthn_credentials
  for insert to authenticated with check (user_id = auth.uid());
create policy "webauthn_credentials update own" on public.webauthn_credentials
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "webauthn_credentials delete own" on public.webauthn_credentials
  for delete to authenticated using (user_id = auth.uid());
