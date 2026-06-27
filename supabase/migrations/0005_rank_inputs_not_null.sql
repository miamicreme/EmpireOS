-- =============================================================================
-- Empire OS — Migration 0005
--
-- Makes rank input columns NOT NULL with sensible defaults. Previously the
-- CHECK constraints in 0003 allowed NULL, so a direct client update could
-- set effort_score = null and the trigger would coalesce it to 0, producing
-- an inflated rank_score without the API ever permitting null values.
--
-- Defaults match the Zod schema defaults in createGlobalActionSchema.
-- =============================================================================

alter table public.global_actions
  alter column impact_score      set not null,
  alter column impact_score      set default 5,
  alter column urgency_score     set not null,
  alter column urgency_score     set default 5,
  alter column effort_score      set not null,
  alter column effort_score      set default 5,
  alter column confidence_score  set not null,
  alter column confidence_score  set default 0.5,
  alter column empire_score_weight set not null,
  alter column empire_score_weight set default 1;

-- Update the CHECK constraints to remove the IS NULL branch (columns are now NOT NULL).
alter table public.global_actions
  drop constraint chk_impact_score,
  drop constraint chk_urgency_score,
  drop constraint chk_effort_score,
  drop constraint chk_confidence_score,
  drop constraint chk_empire_score_weight;

alter table public.global_actions
  add constraint chk_impact_score
    check (impact_score >= 0 and impact_score <= 10),
  add constraint chk_urgency_score
    check (urgency_score >= 0 and urgency_score <= 10),
  add constraint chk_effort_score
    check (effort_score >= 0 and effort_score <= 10),
  add constraint chk_confidence_score
    check (confidence_score >= 0 and confidence_score <= 1),
  add constraint chk_empire_score_weight
    check (empire_score_weight >= 0 and empire_score_weight <= 5);
