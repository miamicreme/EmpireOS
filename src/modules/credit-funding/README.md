# Credit & Funding Module

Tracks credit items (disputes, open items, resolved accounts) and computes a funding readiness score.

## DB Tables
- `credit_items` — individual credit items per bureau (migration 0001)
- `credit_snapshots` — periodic score snapshots (migration 0007)
- `funding_tasks` — tasks to improve credit/funding status (migration 0007)

## Key Metrics
- `funding_readiness_score` (0–100): resolved items × 100% + disputing × 50%
- `open_disputes`: count of items with status `disputing`
- `items_in_progress`: count with status `open`
- `items_complete`: count with status `resolved`

## Health Logic
- Green: score ≥ 70
- Yellow: no items tracked, or score < 70
- Red: open disputes > 3
