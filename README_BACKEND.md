# Empire OS — Backend

Backend-focused entry point. Start here when building the backend spine, module
system, and decision engine.

## Architecture in one line

**Spine owns priority → Modules own detail → Decisions create actions →
Actions move phases → Phases build the empire.**

## Tech

- Next.js (App Router) server runtime + TypeScript
- Supabase + PostgreSQL with Row Level Security (RLS)
- Zod for runtime validation

## Backend build order

1. **Backend spine** — phases, priorities, action queue, module contract.
   Branch: `feature/spine-backend-v3`.
   Prompt: [`docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md`](./docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md)
2. **Module system** — uniform module contract + first modules.
   Branch: `feature/module-system-v3`.
   Prompt: [`docs/prompts/Module_System_Prompt_V3_High_Tech.md`](./docs/prompts/Module_System_Prompt_V3_High_Tech.md)
3. **Decision engine** — multi-advisor engine emitting actions.
   Branch: `feature/decision-engine-v3`.

## Key references

- [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
- [`docs/architecture/SPINE_DESIGN.md`](./docs/architecture/SPINE_DESIGN.md)
- [`docs/architecture/MODULE_DESIGN.md`](./docs/architecture/MODULE_DESIGN.md)
- [`docs/architecture/DECISION_ENGINE.md`](./docs/architecture/DECISION_ENGINE.md)
- [`docs/runbook/RUNBOOK.md`](./docs/runbook/RUNBOOK.md)
- [`docs/runbook/VALIDATION.md`](./docs/runbook/VALIDATION.md)
- [`docs/SECURITY.md`](./docs/SECURITY.md)

> Do not start building the backend until explicitly instructed
> ("Start backend spine.").
