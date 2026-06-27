# Acquisitions Module

Tracks business acquisition targets through the deal pipeline.

## DB Tables
- `acquisition_targets` — deal targets with status, scores, financials (migration 0001)
- `acquisition_contacts` — contacts associated with each target (migration 0007)
- `acquisition_scores` — detailed scoring breakdown per target (migration 0007)

## Key Metrics
- `active_targets`: targets not in `closed` or `passed` status
- `targets_reviewed_this_week`: targets created this calendar week
- `seller_financing_targets`: targets where `seller_financing_possible = true`

## Health Logic
- Red: no targets being tracked at all
- Yellow: no targets reviewed this week, or no active targets in pipeline
- Green: active targets in pipeline and reviewed this week
