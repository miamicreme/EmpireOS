-- =============================================================================
-- Empire OS — Migration 0002
--
-- Adds a DB-level trigger that recomputes rank_score on every insert or update
-- of global_actions. This ensures the Spine owns priority regardless of what
-- value the client supplies — rank_score is always derived from the four
-- scoring inputs and can never be set to an arbitrary value via direct DB
-- writes.
--
-- Formula (mirrors action-ranking.service.ts):
--   rank_score = (impact_score + urgency_score + confidence_score - effort_score)
--                * coalesce(empire_score_weight, 1)
-- =============================================================================

create or replace function public.recompute_rank_score()
returns trigger
language plpgsql
as $$
begin
  new.rank_score := round(
    (
      coalesce(new.impact_score, 0)
      + coalesce(new.urgency_score, 0)
      + coalesce(new.confidence_score, 0)
      - coalesce(new.effort_score, 0)
    ) * coalesce(new.empire_score_weight, 1),
    4
  );
  return new;
end;
$$;

drop trigger if exists trg_recompute_rank_score on public.global_actions;

create trigger trg_recompute_rank_score
  before insert or update
  on public.global_actions
  for each row
  execute function public.recompute_rank_score();
