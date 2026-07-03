# Spreadsheet Intelligence

CSV/XLSX inputs are summarized locally before AI reasoning.

## Deterministic analysis

The spreadsheet adapter reports:

- inferred purpose: transactions, contacts, deals, jobs, credit accounts, funding options, or unknown
- row count and columns
- numeric totals
- date range when date columns are present
- outliers
- duplicate rows
- missing values
- suggested next actions

This local-first summary is saved as a `spreadsheet_analysis` artifact and can create approval-gated drafts.
