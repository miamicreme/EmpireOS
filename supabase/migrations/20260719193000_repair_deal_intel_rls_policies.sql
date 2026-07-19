-- Repair migration for 20260719190000_deal_intel_rls_policies.sql.
-- This migration is intentionally idempotent and safe to run more than once
-- (same pattern as 20260719121500_repair_empire_runs.sql).
--
-- Fixes two issues found in review after the original migration merged:
--
-- 1. `create policy` has no `IF NOT EXISTS` in Postgres, so re-running the
--    original migration against a database that already has these policies
--    (e.g. a fresh environment replaying full migration history, or this
--    production project where the fix was hotfixed ahead of the PR) fails
--    outright. Every policy below is now `drop policy if exists` + `create`.
--
-- 2. The original WITH CHECK clauses only verified that a row's own
--    deal_id/asset_id belongs to the caller. They didn't verify that a
--    row's *other* optional cross-referencing foreign keys (evidence_item_id,
--    source_document_id, superseded_by_fact_id, linked_fact_id) point at a
--    row from that same deal. Without RLS, a user could have learned another
--    tenant's row id; with only the original checks, they could still plant
--    a cross-tenant reference on their own row (no read leak, since base RLS
--    still scopes reads by deal_id, but it can block deletion of the
--    referenced row via the FK's default ON DELETE NO ACTION). Three new
--    helper functions validate those optional FKs resolve to the same deal.

create or replace function public.deal_intel_evidence_matches_deal(p_evidence_item_id uuid, p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_evidence_item_id is null or exists (
    select 1 from public.deal_intel_evidence_items e
    where e.id = p_evidence_item_id and e.deal_id = p_deal_id
  );
$$;

create or replace function public.deal_intel_source_document_matches_deal(p_source_document_id uuid, p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_source_document_id is null or exists (
    select 1 from public.deal_intel_source_documents sd
    where sd.id = p_source_document_id and sd.deal_id = p_deal_id
  );
$$;

create or replace function public.deal_intel_fact_matches_deal(p_fact_id uuid, p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_fact_id is null or exists (
    select 1 from public.deal_intel_canonical_facts f
    where f.id = p_fact_id and f.deal_id = p_deal_id
  );
$$;

create or replace function public.deal_intel_asset_matches_deal(p_asset_id uuid, p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_asset_id is null or exists (
    select 1 from public.deal_intel_assets a
    where a.id = p_asset_id and a.deal_id = p_deal_id
  );
$$;

drop policy if exists "owner manages deals" on public.deal_intel_deals;
create policy "owner manages deals" on public.deal_intel_deals
  for all using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "owner manages deal assets" on public.deal_intel_assets;
create policy "owner manages deal assets" on public.deal_intel_assets
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

drop policy if exists "owner manages business profiles" on public.deal_intel_business_profiles;
create policy "owner manages business profiles" on public.deal_intel_business_profiles
  for all using (public.owns_deal_intel_asset(asset_id))
  with check (public.owns_deal_intel_asset(asset_id));

drop policy if exists "owner manages real estate profiles" on public.deal_intel_real_estate_profiles;
create policy "owner manages real estate profiles" on public.deal_intel_real_estate_profiles
  for all using (public.owns_deal_intel_asset(asset_id))
  with check (public.owns_deal_intel_asset(asset_id));

drop policy if exists "owner manages financial snapshots" on public.deal_intel_financial_snapshots;
create policy "owner manages financial snapshots" on public.deal_intel_financial_snapshots
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

-- source_document_id is nullable and self-scoped to the same deal.
drop policy if exists "owner manages source documents" on public.deal_intel_source_documents;
create policy "owner manages source documents" on public.deal_intel_source_documents
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

-- canonical_facts: also validate asset_id, source_document_id, and
-- superseded_by_fact_id all resolve to the same deal, not just deal_id itself.
drop policy if exists "owner manages canonical facts" on public.deal_intel_canonical_facts;
create policy "owner manages canonical facts" on public.deal_intel_canonical_facts
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (
    public.owns_deal_intel_deal(deal_id)
    and public.deal_intel_asset_matches_deal(asset_id, deal_id)
    and public.deal_intel_source_document_matches_deal(source_document_id, deal_id)
    and public.deal_intel_fact_matches_deal(superseded_by_fact_id, deal_id)
  );

-- evidence_items: also validate source_document_id resolves to the same deal.
drop policy if exists "owner manages evidence items" on public.deal_intel_evidence_items;
create policy "owner manages evidence items" on public.deal_intel_evidence_items
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (
    public.owns_deal_intel_deal(deal_id)
    and public.deal_intel_source_document_matches_deal(source_document_id, deal_id)
  );

drop policy if exists "owner manages valuation models" on public.deal_intel_valuation_models;
create policy "owner manages valuation models" on public.deal_intel_valuation_models
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

drop policy if exists "owner manages deal scores" on public.deal_intel_deal_scores;
create policy "owner manages deal scores" on public.deal_intel_deal_scores
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

-- risks: also validate evidence_item_id resolves to the same deal.
drop policy if exists "owner manages risks" on public.deal_intel_risks;
create policy "owner manages risks" on public.deal_intel_risks
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (
    public.owns_deal_intel_deal(deal_id)
    and public.deal_intel_evidence_matches_deal(evidence_item_id, deal_id)
  );

-- upside_drivers: also validate evidence_item_id resolves to the same deal.
drop policy if exists "owner manages upside drivers" on public.deal_intel_upside_drivers;
create policy "owner manages upside drivers" on public.deal_intel_upside_drivers
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (
    public.owns_deal_intel_deal(deal_id)
    and public.deal_intel_evidence_matches_deal(evidence_item_id, deal_id)
  );

drop policy if exists "owner manages scenarios" on public.deal_intel_scenarios;
create policy "owner manages scenarios" on public.deal_intel_scenarios
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

drop policy if exists "owner manages research runs" on public.deal_intel_research_runs;
create policy "owner manages research runs" on public.deal_intel_research_runs
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

drop policy if exists "owner manages agent runs" on public.deal_intel_agent_runs;
create policy "owner manages agent runs" on public.deal_intel_agent_runs
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

-- diligence_tasks: also validate linked_fact_id resolves to the same deal.
drop policy if exists "owner manages diligence tasks" on public.deal_intel_diligence_tasks;
create policy "owner manages diligence tasks" on public.deal_intel_diligence_tasks
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (
    public.owns_deal_intel_deal(deal_id)
    and public.deal_intel_fact_matches_deal(linked_fact_id, deal_id)
  );

drop policy if exists "owner manages analysis reports" on public.deal_intel_analysis_reports;
create policy "owner manages analysis reports" on public.deal_intel_analysis_reports
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

notify pgrst, 'reload schema';
