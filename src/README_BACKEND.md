# Empire OS — Backend Source Map

This is the source-level guide to the backend spine. For the high-level entry
point see the repo-root `README_BACKEND.md`.

## Layout

```
src/
├── app/api/        # Route stubs (health, actions, metrics, decisions, modules, sync)
├── lib/            # Cross-cutting: supabase clients, env, result, errors, logger, dates, security, api
├── spine/          # The Spine: types, schemas, services, orchestrators, registry
│   ├── actions/    # Global action service (+ ranking)
│   ├── metrics/    # Module metric service
│   ├── decisions/  # Decision records, advisors, orchestrator, context redaction
│   ├── reviews/    # Daily/weekly reviews
│   ├── events/     # system_events layer
│   └── audit/      # immutable audit trail
└── modules/        # Domain modules implementing ModuleContract
    ├── _template/  # Copy to create a new module
    ├── cash-engine/
    ├── job-hunt/
    └── followup-crm/
```

## Service convention

Every service function takes `(supabase, userId, ...input)` and returns
`AppResult<T>`. Validation (Zod) runs before any write. RLS enforces isolation
in the database as a second layer. The Spine computes rank/score in the service
layer — never trust client-supplied rank.

## Module convention

A module exposes a `ModuleContract` (`manifest`, `getMetrics`, `getActions`,
`getDecisionContext`, `getHealth`, `syncToSpine`). The Spine only talks to a
module through that contract. Register new modules in `spine/module-registry.ts`.
