# Spreadsheet Intelligence

CSV/XLSX inputs are summarized locally before AI reasoning. XLSX workbooks are parsed from submitted workbook bytes; the adapter reads the first worksheet into the same normalized row shape used by CSV.

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
