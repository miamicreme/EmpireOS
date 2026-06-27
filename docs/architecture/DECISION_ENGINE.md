# AI Decision Engine

The Decision Engine is a **multi-advisor** system. It turns context into
decisions, and **decisions create actions**.

## Purpose

- Gather context from the Spine and Modules.
- Run multiple advisors, each offering an independent perspective.
- Reconcile advisor outputs into a single decision.
- Emit the decision as an **action** onto the Spine's queue.

## Multi-Advisor Model

- Each advisor evaluates the same context through a distinct lens.
- Advisors propose options with rationale and confidence.
- A reconciliation step weighs and merges proposals into one decision.

## Flow

```
Context  →  Advisors (N perspectives)  →  Reconcile  →  Decision  →  Action (Spine)
```

Decisions create actions → actions move phases → phases build the empire.

## Principles

- Advisors are independent; diversity of perspective is the point.
- Every decision is auditable: record inputs, advisor outputs, and the rationale.
- The engine proposes; the Spine owns priority and sequencing.

> Concise placeholder to be expanded as the engine is built (build step 4).
