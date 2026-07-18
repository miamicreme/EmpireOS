create table if not exists public.content_runs (
  id uuid primary key,
  user_id uuid not null,
  source text not null,
  event_type text not null,
  version text not null default '1.0',
  correlation_id uuid,
  article_id text,
  title text,
  channel text,
  status text not null check (status in ('processing','published','failed')) default 'processing',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists content_runs_user_received_idx on public.content_runs(user_id, received_at desc);
create index if not exists content_runs_status_idx on public.content_runs(user_id, status);

alter table public.content_runs enable row level security;

create policy "content_runs_owner_select"
  on public.content_runs for select
  using (auth.uid() = user_id);

create policy "content_runs_owner_update"
  on public.content_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
