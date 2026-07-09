-- Empire OS - LM Studio provider kind
-- Migration: 0023_lmstudio_provider_kind
-- Adds LM Studio as a local/private OpenAI-compatible provider option.

alter table public.ai_providers
  drop constraint if exists ai_providers_provider_check;

alter table public.ai_providers
  add constraint ai_providers_provider_check
  check (provider in (
    'requesty',
    'anthropic',
    'openai',
    'google',
    'lmstudio',
    'groq',
    'cerebras',
    'openrouter',
    'mistral'
  ));
