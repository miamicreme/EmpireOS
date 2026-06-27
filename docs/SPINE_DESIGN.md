# Spine Design (Backend V3)

The Spine owns priority. It is the shared operating system that every module
plugs into. Modules own their detail; the Spine ranks, scores, and orchestrates.

## Responsibilities

- **Global actions** (`global_actions`) — the single action queue. Every module
  creates actions here. The Spine ranks them.
- **Metrics** (`module_metrics`) — time-stamped snapshots modules push up.
- **Empire Score** — one 0–100 number summarizing daily execution.
- **Orchestration** — assembling the command dashboard across modules.
- **Decisions, reviews, events, audit, notifications** — shared spine layers.

## Global actions & ranking

`src/spine/action-ranking.service.ts` computes:

```
rank_score = impact + urgency + confidence - effort   (× empire_score_weight)
```

- impact/urgency/effort are 0–10 integers; confidence is 0–1.
- Rank is computed in the service layer on create/update — never trusted from
  the client. `getRankedActions` returns open actions sorted by rank desc.

## Metrics

`src/spine/metrics/metric.service.ts` records metric snapshots and reads:
today's metrics, per-module metrics, and a trend over N days. Modules can also
expose *derived* metrics (computed, not stored) via their `getMetrics`.

## Empire Score

`src/spine/empire-score.service.ts` weights five components:

| Component             | Weight |
| --------------------- | ------ |
| Cash progress         | 30%    |
| High-priority actions | 25%    |
| Job hunt progress     | 20%    |
| Follow-ups            | 15%    |
| Daily review          | 10%    |

Each component is supplied as a 0–1 ratio; the service returns
`{ score, grade, breakdown }` where grade is green (≥75) / yellow (≥50) / red.

## Orchestration

`src/spine/spine-orchestrator.service.ts`:

- `syncAllModulesToSpine(userId)` — fan out `syncToSpine` across the registry.
- `getCommandDashboardData(userId)` — Empire Score + top actions + module health
  + metrics in one call.
- `getTodayTopActions(userId)` — the top N ranked actions.
- `getModuleHealth(userId)` — per-module green/yellow/red.

## Module registry

`src/spine/module-registry.ts` is the only place the Spine discovers modules.
It aggregates metrics, actions, decision contexts, and health across all active
modules.
