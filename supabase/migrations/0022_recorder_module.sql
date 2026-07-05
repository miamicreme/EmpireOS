-- =============================================================================
-- Empire OS — Empire Recorder module
-- Migration: 0022_recorder_module
--
-- Private audio intelligence: record an interview/meeting, save the source
-- file to Storage, transcribe, translate if needed, summarize, and extract
-- decisions/follow-ups/questions/names/dates/risks as action-draft candidates.
-- Every row and every stored object is owner-only; no public URLs are ever
-- issued (see storage.objects policies below — access is always via a
-- short-lived signed URL minted server-side for the authenticated owner).
-- =============================================================================
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled recording',
  audio_storage_path text not null,
  mime_type text not null,
  duration_seconds numeric,
  language text,
  transcript text,
  translated_transcript text,
  summary text,
  status text not null default 'uploaded'
    check (status in (
      'uploaded', 'transcribing', 'transcribed', 'translating', 'translated',
      'analyzing', 'ready', 'failed'
    )),
  error text,
  consent_confirmed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recordings enable row level security;

create policy "recordings select own" on public.recordings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recordings insert own" on public.recordings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recordings update own" on public.recordings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recordings delete own" on public.recordings
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger set_recordings_updated_at
  before update on public.recordings
  for each row execute function public.set_updated_at();

create index if not exists recordings_user_created_idx on public.recordings (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for source audio files. `public = false` means no
-- object is ever reachable by a bare public URL; the app always mints a
-- short-lived signed URL server-side for the authenticated owner. Objects are
-- keyed "<user_id>/<recording_id>.<ext>" so the owner-only policies below can
-- check ownership from the path alone.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "recordings storage select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "recordings storage insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "recordings storage delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Register the module so module_id FKs (global_actions, ai_action_drafts,
-- module_metrics) resolve.
insert into public.modules (id, name, slug, description, route, icon, priority) values
  ('recorder', 'Empire Recorder', 'recorder', 'Record interviews and conversations, then transcribe, translate, and turn them into notes and action drafts.', '/recorder', 'mic', 70)
on conflict (id) do update set name = excluded.name, description = excluded.description, route = excluded.route, icon = excluded.icon;
