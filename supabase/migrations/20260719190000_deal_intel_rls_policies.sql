-- Deal Intelligence Engine: owner-only RLS.
-- 0019_deal_intelligence_engine.sql created these 17 tables with RLS off,
-- leaving them fully exposed to the anon/authenticated PostgREST roles.
-- Ownership lives on deal_intel_deals.owner_user_id; every other table is
-- scoped to a deal (directly, or via an asset that belongs to a deal). Two
-- small SECURITY INVOKER helpers express that ownership chain once instead
-- of repeating the join in every policy.

create or replace function public.owns_deal_intel_deal(p_deal_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.deal_intel_deals d
    where d.id = p_deal_id and d.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_deal_intel_asset(p_asset_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.deal_intel_assets a
    join public.deal_intel_deals d on d.id = a.deal_id
    where a.id = p_asset_id and d.owner_user_id = (select auth.uid())
  );
$$;

alter table public.deal_intel_deals enable row level security;
create policy "owner manages deals" on public.deal_intel_deals
  for all using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

alter table public.deal_intel_assets enable row level security;
create policy "owner manages deal assets" on public.deal_intel_assets
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_business_profiles enable row level security;
create policy "owner manages business profiles" on public.deal_intel_business_profiles
  for all using (public.owns_deal_intel_asset(asset_id))
  with check (public.owns_deal_intel_asset(asset_id));

alter table public.deal_intel_real_estate_profiles enable row level security;
create policy "owner manages real estate profiles" on public.deal_intel_real_estate_profiles
  for all using (public.owns_deal_intel_asset(asset_id))
  with check (public.owns_deal_intel_asset(asset_id));

alter table public.deal_intel_financial_snapshots enable row level security;
create policy "owner manages financial snapshots" on public.deal_intel_financial_snapshots
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_source_documents enable row level security;
create policy "owner manages source documents" on public.deal_intel_source_documents
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_canonical_facts enable row level security;
create policy "owner manages canonical facts" on public.deal_intel_canonical_facts
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_evidence_items enable row level security;
create policy "owner manages evidence items" on public.deal_intel_evidence_items
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_valuation_models enable row level security;
create policy "owner manages valuation models" on public.deal_intel_valuation_models
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_deal_scores enable row level security;
create policy "owner manages deal scores" on public.deal_intel_deal_scores
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_risks enable row level security;
create policy "owner manages risks" on public.deal_intel_risks
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_upside_drivers enable row level security;
create policy "owner manages upside drivers" on public.deal_intel_upside_drivers
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_scenarios enable row level security;
create policy "owner manages scenarios" on public.deal_intel_scenarios
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_research_runs enable row level security;
create policy "owner manages research runs" on public.deal_intel_research_runs
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

-- deal_id is nullable here (an agent run need not be tied to a deal). A null
-- deal_id can never satisfy owns_deal_intel_deal, so such rows are reachable
-- only via the service-role client — consistent with every other table's
-- owner-only-through-a-deal invariant, not a new restriction.
alter table public.deal_intel_agent_runs enable row level security;
create policy "owner manages agent runs" on public.deal_intel_agent_runs
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_diligence_tasks enable row level security;
create policy "owner manages diligence tasks" on public.deal_intel_diligence_tasks
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

alter table public.deal_intel_analysis_reports enable row level security;
create policy "owner manages analysis reports" on public.deal_intel_analysis_reports
  for all using (public.owns_deal_intel_deal(deal_id))
  with check (public.owns_deal_intel_deal(deal_id));

notify pgrst, 'reload schema';
