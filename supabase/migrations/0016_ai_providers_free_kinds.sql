-- =============================================================================
-- Empire OS — Free-tier fallback provider kinds
-- Migration: 0016_ai_providers_free_kinds
--
-- 0012 constrained ai_providers.provider to anthropic/openai/google. Add the
-- OpenAI-API-compatible free-tier providers (groq, cerebras, openrouter,
-- mistral) so the AI layer can fail over to a free provider when a paid quota
-- is exhausted. Idempotent: finds the existing provider CHECK by definition and
-- replaces it.
-- =============================================================================
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'ai_providers'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%provider%';
  if conname is not null then
    execute format('alter table public.ai_providers drop constraint %I', conname);
  end if;
end $$;

alter table public.ai_providers
  add constraint ai_providers_provider_check
  check (provider in ('anthropic', 'openai', 'google', 'groq', 'cerebras', 'openrouter', 'mistral'));
