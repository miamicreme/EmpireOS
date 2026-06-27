# Projects Module

Manages active projects and enforces focus discipline (≤3 active projects).

## DB Table
- `projects` — project records with status, focus level, blocker, strategic value (migration 0001)

## Key Metrics
- `active_projects`: count with status `active`
- `parked_projects`: count with status `paused`
- `blocked_projects`: active projects where `blocker` is not null

## Health Logic
- Green: ≤3 active projects
- Yellow: 4–5 active projects
- Red: >5 active projects (distraction risk)
