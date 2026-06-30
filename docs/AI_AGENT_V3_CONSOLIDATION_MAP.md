# Empire OS V3 — Consolidation Map

This map prevents redundant V3 implementation.

## Canonical Services

Use these as the V3 source of truth:

```txt
agent-orchestrator.service.ts      owns one full run
intent-router.service.ts           classifies intent/stakes/mode
capability-planner.service.ts      plans what the run needs
permission-policy.service.ts       approves/blocks capabilities
context-pack.service.ts            builds compact context
memory-manager.service.ts          retrieves/saves/requests memory
research-router.service.ts         decides research need/status
provider-router.service.ts         selects models/providers
specialist-panel.service.ts        runs necessary specialists
final-synthesizer.service.ts       produces final response
agent-session.service.ts           sessions/turns/runs lifecycle
agent-artifact.service.ts          stores final structured outputs
action-draft.service.ts            drafts/approves Spine actions
```

Do not create another service with the same responsibility under a different name.

## Existing V2 Mapping

```txt
V2 daily-brief.service.ts       -> V3 creates agent_artifact type='daily_brief'
V2 recommendation.service.ts    -> V3 creates agent_artifact type='recommendation'
V2 action-draft.service.ts      -> V3 uses/extends canonical action draft service
V2 module-copilot.service.ts    -> V3 specialist/capability route with module context
V2 chief-of-staff.service.ts    -> V3 agent-orchestrator standard_path
V2 context snapshots            -> V3 agent_context_packs
V2 ai_usage_events              -> V3 agent_provider_runs + agent_tool_runs
```

Adapters are acceptable. Duplicate logic is not.

## Canonical Routes

Primary V3 route:

```txt
POST /api/ai/agent/run
```

All quick actions and AI UI should call this route unless there is a specific CRUD reason not to.

V2 routes can remain for compatibility, but they should internally call V3 services where practical.

## Canonical UI

Primary V3 page:

```txt
/app/ai/agent
```

Existing pages can remain:

```txt
/app/ai
/app/ai/brief
/app/ai/recommendations
/app/ai/chat
/app/ai/decisions
```

But they should become views into the same agent sessions/artifacts/actions, not isolated feature islands.

## Canonical Data Flow

```txt
User command
-> agent_turn
-> agent_run
-> agent_context_pack
-> agent_steps
-> agent_provider_runs
-> agent_specialist_votes
-> agent_artifacts
-> agent_action_drafts
-> global_actions only after approval
```

## Remove or Avoid

Avoid creating:

```txt
separate chatbot brain
separate recommendation engine
separate brief engine
separate module copilot brain
separate provider router per feature
separate memory tables per feature
separate research table per feature
unlogged provider calls
unapproved action creation
```

## Refactor Rule

When adding V3, prefer:

```txt
extract shared logic -> call from old and new routes
```

not:

```txt
copy old logic -> modify in place -> create divergence
```
