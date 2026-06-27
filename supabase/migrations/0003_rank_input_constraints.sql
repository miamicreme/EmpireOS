-- =============================================================================
-- Empire OS — Migration 0003
--
-- Adds CHECK constraints on global_actions rank input columns so that even
-- direct DB writes (bypassing the API) cannot supply out-of-range values.
-- Mirrors the Zod schema bounds in src/spine/schemas.ts:
--   impact_score, urgency_score, effort_score  → 0..10 (integer)
--   confidence_score                            → 0..1  (numeric)
--   empire_score_weight                         → 0..5  (numeric, nullable)
-- =============================================================================

alter table public.global_actions
  add constraint chk_impact_score
    check (impact_score is null or (impact_score >= 0 and impact_score <= 10)),
  add constraint chk_urgency_score
    check (urgency_score is null or (urgency_score >= 0 and urgency_score <= 10)),
  add constraint chk_effort_score
    check (effort_score is null or (effort_score >= 0 and effort_score <= 10)),
  add constraint chk_confidence_score
    check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  add constraint chk_empire_score_weight
    check (empire_score_weight is null or (empire_score_weight >= 0 and empire_score_weight <= 5));
