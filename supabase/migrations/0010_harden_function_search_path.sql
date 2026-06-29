-- 0010_harden_function_search_path.sql
-- Security hardening: pin an immutable search_path on our trigger functions.
--
-- Without an explicit search_path a function resolves object names against the
-- caller's path, which an attacker could manipulate to shadow built-ins. Both
-- functions only call pg_catalog built-ins (now(), round(), coalesce()) and
-- operate on the NEW row, so an empty search_path is safe and closes the
-- Supabase linter warning `function_search_path_mutable`.

alter function public.set_updated_at() set search_path = '';
alter function public.recompute_rank_score() set search_path = '';
