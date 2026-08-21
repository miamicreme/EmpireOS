-- Durable, owner-scoped document intake and routing.

insert into storage.buckets (id, name, public, file_size_limit)
values ('empire-documents', 'empire-documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create table if not exists public.empire_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null,
  storage_bucket text not null default 'empire-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint not null check (file_size >= 0),
  sha256 text not null,
  document_kind text not null,
  status text not null default 'uploaded' check (status in ('uploaded','extracting','extracted','analyzing','analyzed','routing_pending','routed','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sha256)
);

create table if not exists public.empire_document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.empire_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  extraction_method text not null,
  text_content text,
  structured_content jsonb not null default '{}'::jsonb,
  page_count integer,
  sheet_count integer,
  word_count integer not null default 0,
  status text not null check (status in ('completed','needs_ocr','unsupported','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.empire_document_analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.empire_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_id uuid,
  analysis_version integer not null default 1,
  purpose text not null default 'general_review',
  summary text,
  key_facts jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  confidence numeric(4,3),
  provider text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  unique (document_id, analysis_version)
);

create table if not exists public.empire_document_routes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.empire_documents(id) on delete cascade,
  analysis_id uuid references public.empire_document_analyses(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_module text not null,
  target_entity_type text,
  confidence numeric(4,3) not null default 0.5,
  reason text,
  proposed_actions jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','completed','failed')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.empire_document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.empire_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_module text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  relationship text not null default 'derived_from',
  created_at timestamptz not null default now(),
  unique (document_id, target_module, target_entity_type, target_entity_id)
);

create index if not exists empire_documents_user_created_idx on public.empire_documents(user_id, created_at desc);
create index if not exists empire_document_routes_user_status_idx on public.empire_document_routes(user_id, status, created_at desc);
create index if not exists empire_document_links_document_idx on public.empire_document_links(document_id);

alter table public.empire_documents enable row level security;
alter table public.empire_document_extractions enable row level security;
alter table public.empire_document_analyses enable row level security;
alter table public.empire_document_routes enable row level security;
alter table public.empire_document_links enable row level security;

create policy "owner manages documents" on public.empire_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner manages document extractions" on public.empire_document_extractions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner manages document analyses" on public.empire_document_analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner manages document routes" on public.empire_document_routes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner manages document links" on public.empire_document_links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner uploads private documents" on storage.objects for insert to authenticated
with check (bucket_id = 'empire-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner reads private documents" on storage.objects for select to authenticated
using (bucket_id = 'empire-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes private documents" on storage.objects for delete to authenticated
using (bucket_id = 'empire-documents' and (storage.foldername(name))[1] = auth.uid()::text);

grant select, insert, update, delete on public.empire_documents to authenticated, service_role;
grant select, insert, update, delete on public.empire_document_extractions to authenticated, service_role;
grant select, insert, update, delete on public.empire_document_analyses to authenticated, service_role;
grant select, insert, update, delete on public.empire_document_routes to authenticated, service_role;
grant select, insert, update, delete on public.empire_document_links to authenticated, service_role;

notify pgrst, 'reload schema';