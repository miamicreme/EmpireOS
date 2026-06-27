# Module Design

**Modules own detail.** Each module is a self-contained domain that plugs into
the Spine through a consistent contract.

## Purpose

- Encapsulate the deep state and logic of one domain.
- Expose a uniform interface so the Spine can orchestrate without knowing internals.
- Own its own database tables, validation schemas, and business rules.

## Module Contract (initial sketch)

Every module should provide:

- **State** — its own tables (PostgreSQL + RLS).
- **Schemas** — Zod validation for all inputs and outputs.
- **Handlers** — accept actions from the Spine and report results back.
- **Status** — surface progress so the Spine can advance phases.

## Principles

- A module never overrides global priority; the Spine owns that.
- Modules communicate with the Spine via actions, not directly with each other.
- Adding a module must not require changing the Spine's core.

> Concise placeholder. Full design is built from
> [`../prompts/Module_System_Prompt_V3_High_Tech.md`](../prompts/Module_System_Prompt_V3_High_Tech.md).
