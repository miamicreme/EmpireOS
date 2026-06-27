# Empire OS Modules

Each module owns a domain, implements `ModuleContract`, and is registered in `src/spine/module-registry.ts`.

## Registered Modules

| Module | ID | Phase | Description |
|--------|----|-------|-------------|
| Cash Engine | `cash-engine` | phase_0 | Track and grow short-term cash flow |
| Credit & Funding | `credit-funding` | phase_0 | Track credit scores, disputes, and funding readiness |
| High-Income Job Hunt | `job-hunt` | phase_1 | Manage high-income job applications and pipeline |
| Follow-Up CRM | `followup-crm` | phase_1 | Track contacts and follow-ups |
| Projects | `projects` | phase_1 | Manage active projects and prevent distraction |
| Acquisitions | `acquisitions` | phase_2 | Research, track, and close business acquisition targets |

## Module Structure

Every module folder contains:
- `manifest.ts` — module ID, name, capabilities, phase
- `types.ts` — domain types
- `schemas.ts` — Zod validation schemas
- `metrics.ts` — `getMetrics()` + `getHealth()`
- `actions.ts` — `getActions()` from global_actions
- `decisions.ts` — `getDecisionContext()` for AI layer
- `events.ts` — emit system events
- `health.ts` — re-export of `getHealth()`
- `service.ts` — CRUD functions + `ModuleContract` export
- `api.ts` — API stub (routes in `src/app/api/modules/`)

## API Routes

- `POST /api/modules/sync` — sync all modules, return health report
- `GET /api/modules/health` — all module health checks
- `GET /api/modules/metrics` — all module metrics
- `GET /api/modules/actions` — all module actions
