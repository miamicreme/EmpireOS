# Empire OS Modules

Each module owns a domain, implements `ModuleContract`, and is registered in `src/spine/module-registry.ts`.

The Spine owns priority. Modules own detail. A module should never bypass the Spine for global ranking, daily priority, cross-module action ordering, or final Jarvis synthesis.

## Registered Modules

| Module | ID | Phase | Description |
|--------|----|-------|-------------|
| Cash Engine | `cash-engine` | phase_0 | Track and grow short-term cash flow |
| Finances | `finances` | phase_0 | Track personal finances, financial context, and cash intelligence |
| Credit & Funding | `credit-funding` | phase_0 | Track credit scores, disputes, and funding readiness |
| High-Income Job Hunt | `job-hunt` | phase_1 | Manage high-income job applications and pipeline |
| Follow-Up CRM | `followup-crm` | phase_1 | Track contacts and follow-ups |
| Projects | `projects` | phase_1 | Manage active projects and prevent distraction |
| Acquisitions | `acquisitions` | phase_2 | Research, track, and close business acquisition targets |
| Deal Intelligence | `deal-intel` | phase_2 | Analyze deals and create deal intelligence context |
| Empire Recorder | `recorder` | phase_1 | Record interviews/conversations; transcribe, translate, summarize, and draft actions |

## Module Structure

Every module folder contains:

- `manifest.ts` — module ID, name, capabilities, phase
- `types.ts` — domain types when module-specific types are needed
- `schemas.ts` — Zod validation schemas
- `metrics.ts` — `getMetrics()` + `getHealth()`
- `actions.ts` — `getActions()` from global_actions
- `decisions.ts` — `getDecisionContext()` for AI layer
- `events.ts` — emit safe system events
- `health.ts` — re-export of `getHealth()` when useful
- `service.ts` — CRUD functions + `ModuleContract` export
- `api.ts` — API helper/stub when routes are separated under `src/app/api/`

## API Routes

- `POST /api/modules/sync` — sync all modules, return health report
- `GET /api/modules/health` — all module health checks
- `GET /api/modules/metrics` — all module metrics
- `GET /api/modules/actions` — all module actions

## Best-practice rules

- Modules own domain data and domain workflows.
- The Spine owns global priority, phase movement, and cross-module decisions.
- AI-generated module outputs should become artifacts, decision context, or approval-gated action drafts.
- Sensitive files must use private storage only.
- No module should log raw transcripts, audio content, secrets, or full private payloads.
- Module failures should degrade safely and show red health, not crash the whole Spine.

See `docs/SPINE_MODULE_GUARDRAILS.md` for the full checklist.
