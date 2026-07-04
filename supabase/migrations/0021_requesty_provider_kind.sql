-- Empire OS - Requesty provider kind
-- Migration: 0021_requesty_provider_kind
-- Keeps direct provider keys supported while allowing Requesty to be configured
-- as an OpenAI-compatible router in the provider registry.

do $$
declare
  conname text;
begin
  select c.conname into conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'ai_providers'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%provider%';

  if conname is not null then
    execute format('alter table public.ai_providers drop constraint %I', conname);
  end if;
end $$;

alter table public.ai_providers
  add constraint ai_providers_provider_check
  check (provider in ('requesty', 'anthropic', 'openai', 'google', 'groq', 'cerebras', 'openrouter', 'mistral'));
