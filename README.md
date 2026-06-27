# Empire OS

Private execution operating system for KJB Empire planning.

## Architecture

- **Spine** — owns priority. The central nervous system that decides what matters now.
- **Modules** — own detail. Domain-specific units of work and state.
- **AI Decision Engine** — a multi-advisor engine that turns information into decisions.

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

- ✅ Documentation setup
- ⏭️ Backend spine next

## Build Order

1. Repo / docs organization
2. Backend spine
3. Module system
4. Decision engine
5. Dashboard UI
6. Individual module UIs
7. Validation and deployment

## Important Docs

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
