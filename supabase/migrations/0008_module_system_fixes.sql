-- =============================================================================
-- Empire OS — Migration 0008: Module System Fixes
--
-- 1. Add unique constraint on module_metrics(user_id, module_id, metric_key, date)
--    so the ON CONFLICT upsert in syncModuleMetricsToSpine actually resolves.
--    Without this, Postgres rejects the ON CONFLICT target and writes are silently
--    dropped by the unchecked Supabase client call.
--
-- 2. Tighten RLS insert/update policies on acquisition_contacts and
--    acquisition_scores to require that the referenced target_id is owned by
--    auth.uid(). Previously a client could attach a child row to another user's
--    target, creating cross-tenant state.
-- =============================================================================

-- 1. Unique constraint for module_metrics upsert ---------------------------
alter table public.module_metrics
  add constraint uq_module_metrics_user_module_key_date
    unique (user_id, module_id, metric_key, date);

-- 2. Tighten acquisition_contacts insert/update policies -------------------
drop policy if exists "acquisition_contacts insert own" on public.acquisition_contacts;
drop policy if exists "acquisition_contacts update own" on public.acquisition_contacts;

create policy "acquisition_contacts insert own" on public.acquisition_contacts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      target_id is null
      or exists (
        select 1 from public.acquisition_targets t
        where t.id = target_id and t.user_id = auth.uid()
      )
    )
  );

create policy "acquisition_contacts update own" on public.acquisition_contacts
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      target_id is null
      or exists (
        select 1 from public.acquisition_targets t
        where t.id = target_id and t.user_id = auth.uid()
      )
    )
  );

-- 3. Tighten acquisition_scores insert/update policies ---------------------
drop policy if exists "acquisition_scores insert own" on public.acquisition_scores;
drop policy if exists "acquisition_scores update own" on public.acquisition_scores;

create policy "acquisition_scores insert own" on public.acquisition_scores
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      target_id is null
      or exists (
        select 1 from public.acquisition_targets t
        where t.id = target_id and t.user_id = auth.uid()
      )
    )
  );

create policy "acquisition_scores update own" on public.acquisition_scores
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      target_id is null
      or exists (
        select 1 from public.acquisition_targets t
        where t.id = target_id and t.user_id = auth.uid()
      )
    )
  );
