# Spine Design

The Spine is the backbone of Empire OS. **It owns priority.**

## Purpose

- Hold the global priority ordering across all modules.
- Track the current **phase** of the empire.
- Manage the queue of **actions** produced by decisions.
- Provide a stable contract that modules and the decision engine plug into.

## Responsibilities

- Maintain canonical state: phases, priorities, action queue.
- Accept actions (from the decision engine) and route them to modules.
- Advance phases as actions complete.
- Enforce ordering — never let a module override global priority.

## What the Spine Does NOT Do

- It does not implement domain-specific detail (that belongs to Modules).
- It does not generate decisions (that belongs to the Decision Engine).

## Data (initial sketch)

- `phases` — ordered lifecycle stages of the empire.
- `priorities` — ranked focus areas owned by the Spine.
- `actions` — units of work created by decisions, moving phases forward.

All tables use PostgreSQL with Row Level Security. Inputs validated with Zod.

> This is a concise placeholder. Full design is built from
> [`../prompts/Backend_Spine_Prompt_V3_High_Tech.md`](../prompts/Backend_Spine_Prompt_V3_High_Tech.md).
