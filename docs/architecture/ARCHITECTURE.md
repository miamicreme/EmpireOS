# Empire OS — Architecture

Empire OS is a private execution operating system. It is built around three
cooperating layers: the **Spine**, the **Modules**, and the **AI Decision Engine**.

## Core Principles

- The **Spine owns priority** — it is the single source of truth for what matters now.
- **Modules own detail** — each module manages the deep state of one domain.
- **Decisions create actions.**
- **Actions move phases.**
- **Phases build the empire.**

## Layers

### 1. Spine
The backbone. Holds global priority, the current phase, and the queue of actions
that flow between modules. It does not implement domain detail; it orchestrates.

### 2. Modules
Self-contained domains (e.g. finance, operations, growth). Each module exposes a
consistent contract to the Spine and owns its own tables, validation, and logic.

### 3. AI Decision Engine
A multi-advisor engine. Multiple advisors evaluate context and propose options;
the engine reconciles them into a decision, which becomes an action on the Spine.

## Tech Stack

- Next.js (App Router) + TypeScript
- Supabase + PostgreSQL with Row Level Security (RLS)
- Zod for runtime validation
- Tailwind for UI

## Build Order

1. Repo / docs organization
2. Backend spine
3. Module system
4. Decision engine
5. Dashboard UI
6. Individual module UIs
7. Validation and deployment

See companion docs: [`SPINE_DESIGN.md`](./SPINE_DESIGN.md),
[`MODULE_DESIGN.md`](./MODULE_DESIGN.md),
[`DECISION_ENGINE.md`](./DECISION_ENGINE.md).
