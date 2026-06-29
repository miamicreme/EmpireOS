# Empire OS

Private execution operating system for KJB Empire planning.

## Architecture

- **Spine** — owns priority. The central nervous system that decides what matters now.
- **Modules** — own detail. Domain-specific units of work and state.
- **AI Decision Engine** — a multi-advisor engine that turns information into decisions.
- **AI Chief of Staff (V2)** — an AI execution layer on top of the Spine that reads your full context, ranks today's actions, generates a daily brief, and drafts actions for you to approve. See [`docs/AI_V2_DESIGN.md`](./docs/AI_V2_DESIGN.md).

Flow: **Decisions create actions → Actions move phases → Phases build the empire.**

## Tech Stack

- Next.js (App Router)
- TypeScript
- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Zod
- Tailwind

## Current Build Status

- ✅ Documentation & repo organization
- ✅ Backend spine (actions, decisions, metrics, reviews, events, audit)
- ✅ Module system (6 modules on a uniform `ModuleContract`)
- ✅ AI decision engine (multi-advisor, redaction-gated)
- ✅ Module CRUD + review API routes (auth + RLS + Zod on every write)
- ✅ Dashboard UI + command center
- ✅ Individual module UIs (all 6 wired to their APIs)
- ✅ AI V2 — AI Chief of Staff (context engine, daily brief, recommendations, action drafts, module copilots)
- ✅ Test suite — 194 passing (typecheck + lint + build clean)
- ⏭️ Deployment & live Supabase wiring next

See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the detailed status and next steps.

## Build Order

1. ✅ Repo / docs organization
2. ✅ Backend spine
3. ✅ Module system
4. ✅ Decision engine
5. ✅ Dashboard UI
6. ✅ Individual module UIs
7. ⏭️ Validation and deployment

## Important Docs

- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy + first passkey login
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) — status & next steps
- [`CLAUDE_BUILD_INSTRUCTIONS.md`](./CLAUDE_BUILD_INSTRUCTIONS.md)
- [`MASTER_GUIDE.md`](./MASTER_GUIDE.md)
- [`docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md`](./docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md)
- [`docs/prompts/Module_System_Prompt_V3_High_Tech.md`](./docs/prompts/Module_System_Prompt_V3_High_Tech.md)
- [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
- [`docs/runbook/BRANCHING.md`](./docs/runbook/BRANCHING.md)

## Documentation Map

```
.
├── README.md                  # This file
├── README_BACKEND.md          # Backend-focused entry point
├── CLAUDE_BUILD_INSTRUCTIONS.md
├── MASTER_GUIDE.md
└── docs/
    ├── SECURITY.md
    ├── prompts/
    │   ├── Backend_Spine_Prompt_V3_High_Tech.md
    │   └── Module_System_Prompt_V3_High_Tech.md
    ├── architecture/
    │   ├── ARCHITECTURE.md
    │   ├── SPINE_DESIGN.md
    │   ├── MODULE_DESIGN.md
    │   └── DECISION_ENGINE.md
    └── runbook/
        ├── BRANCHING.md
        ├── RUNBOOK.md
        └── VALIDATION.md
```
