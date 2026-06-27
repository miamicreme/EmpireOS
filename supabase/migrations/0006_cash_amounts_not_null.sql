-- =============================================================================
-- Empire OS — Migration 0006
--
-- Makes gross_amount and expenses NOT NULL on cash_entries. PostgreSQL CHECK
-- constraints pass NULL, so migration 0004's non-negative checks could not
-- prevent null writes. A null gross_amount or expenses produces a null
-- net_amount (generated column), corrupting the Cash Today metric and
-- Empire Score even though the API schema never allows null amounts.
--
-- Defaults: 0 to allow safe backfilling of any pre-existing null rows.
-- =============================================================================

alter table public.cash_entries
  alter column gross_amount set not null,
  alter column gross_amount set default 0,
  alter column expenses     set not null,
  alter column expenses     set default 0;
