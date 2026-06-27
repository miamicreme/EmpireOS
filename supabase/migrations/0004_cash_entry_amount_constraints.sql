-- =============================================================================
-- Empire OS — Migration 0004
--
-- Adds CHECK constraints on cash_entries amount columns to mirror the Zod
-- min(0) bounds in createCashEntrySchema. Without these, a direct DB write
-- can store negative gross_amount or expenses, inflating the generated
-- net_amount column and corrupting the Cash Today metric and Empire Score.
-- =============================================================================

alter table public.cash_entries
  add constraint chk_gross_amount_non_negative
    check (gross_amount >= 0),
  add constraint chk_expenses_non_negative
    check (expenses >= 0);
