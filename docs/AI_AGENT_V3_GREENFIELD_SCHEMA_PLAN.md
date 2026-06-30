# Empire OS V3 — Greenfield Compact Schema Plan

This is the canonical greenfield schema plan for Empire OS V3.

The earlier V3 idea had many useful concepts, but the final build should be compact: one runtime, fewer tables, less duplication, less churn.

## Final Schema Goal

```txt
One command comes in.
One agent run handles it.
One compact trace records what happened.
One artifact stores the useful output.
One approval path turns drafts into Spine actions.
```

## Canonical Compact Tables

Use these tables as the default V3 schema:

```txt
agent_threads
agent_runs
agent_run_events
agent_context_packs
agent_artifacts
agent_action_drafts
agent_memory_items
agent_sources
agent_provider_runs
agent_feedback
```

## Why This Is Better

This avoids redundant tables for every internal detail.

Instead of separate tables for capability plans, research requests, source evaluations, specialist votes, tool runs, and step logs, V3 uses `agent_run_events` with typed event payloads.

```txt
capability_plan      -> agent_run_events event_type = capability_plan
memory_request       -> agent_run_events event_type = memory_request
research_request     -> agent_run_events event_type = research_request
source_evaluation    -> agent_sources fields or agent_run_events
specialist_vote      -> agent_run_events event_type = specialist_vote
tool_run             -> agent_run_events event_type = tool_run
step_log             -> agent_run_events event_type = step
```

Promote any event type to its own table only when the UI or performance requires it.

## Table Responsibilities

### agent_threads
Long-running user work streams.

Examples:

```txt
Daily planning
Funding strategy
Blackstone job opportunity
Acquisition analysis
Stock watchlist
```

### agent_runs
One user command and one orchestrated AI execution.

Stores:

```txt
user command
intent
runtime path
status
final summary
risk level
confidence
needs_memory
needs_research
needs_approval
latency/cost summary
```

### agent_run_events
The compact ordered trace of the run.

Stores event types like:

```txt
intent_detected
capability_plan
permission_check
context_built
memory_gate
research_gate
provider_selected
specialist_vote
tool_run
source_evaluated
final_synthesized
action_drafts_created
error
```

This replaces many separate small tables.

### agent_context_packs
The redacted context briefing used by the agent.

Store compact summaries and pointers, not raw dumps.

### agent_artifacts
Final useful outputs.

Types:

```txt
answer
daily_brief
recommendation
strategy_plan
deal_analysis
market_analysis
credit_funding_plan
research_report
decision_summary
action_plan
```

### agent_action_drafts
Only proposed actions that can become real Spine `global_actions`.

### agent_memory_items
Durable user context only. Do not duplicate module data here.

### agent_sources
External research sources used by the run.

### agent_provider_runs
Provider/model calls, cost, latency, fallback status, and redaction status.

### agent_feedback
User corrections, ratings, accepted/rejected outcomes, and learning signals.

## Required Migration

Create:

```txt
supabase/migrations/0014_agent_v3_compact_runtime.sql
```

It must:

```txt
create compact agent_* tables
enable RLS on all user-owned tables
add auth.uid() = user_id policies
add practical indexes
avoid destructive changes to V2 ai_* tables
```

## Compatibility Rule

Existing V2 `ai_*` tables may remain. Do not expand them for V3.

Bridge them like this:

```txt
V2 brief UI             reads/writes agent_artifacts daily_brief through adapter
V2 recommendations      reads/writes agent_artifacts recommendation through adapter
V2 action drafts        maps to agent_action_drafts
V2 conversations        maps to agent_threads/runs/artifacts
V2 usage events         maps to agent_provider_runs/run_events
```

## Minimal Table Draft

Use this as the schema direction, adapting to existing repo conventions:

```sql
create table agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  mode text not null default 'general',
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references agent_threads(id) on delete set null,
  idempotency_key text,
  user_command text not null,
  intent text,
  runtime_path text not null default 'standard_path',
  status text not null default 'queued',
  final_summary text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  risk_level text,
  needs_memory boolean not null default false,
  needs_research boolean not null default false,
  needs_approval boolean not null default false,
  cost_estimate numeric,
  latency_ms int,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(user_id, idempotency_key)
);

create table agent_run_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references agent_runs(id) on delete cascade,
  event_order int not null,
  event_type text not null,
  status text not null default 'complete',
  summary text,
  payload jsonb not null default '{}',
  latency_ms int,
  created_at timestamptz not null default now(),
  unique(run_id, event_order)
);

create table agent_context_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references agent_runs(id) on delete cascade,
  context_hash text not null,
  context_version text not null default 'v3_compact',
  summary text,
  source_refs jsonb not null default '[]',
  record_refs jsonb not null default '[]',
  redacted_context_json jsonb not null default '{}',
  redaction_summary jsonb not null default '{}',
  token_estimate int,
  created_at timestamptz not null default now()
);

create table agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references agent_runs(id) on delete set null,
  artifact_type text not null,
  title text,
  summary text,
  content_json jsonb not null default '{}',
  source_refs jsonb not null default '[]',
  action_draft_refs jsonb not null default '[]',
  confidence numeric check (confidence >= 0 and confidence <= 1),
  risk_level text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
```

Continue the same pattern for:

```txt
agent_action_drafts
agent_memory_items
agent_sources
agent_provider_runs
agent_feedback
```

## No-Churn Rule

Do not rewrite existing working features just to match names.

Use adapters first. Migrate once behavior is stable.

## Final Acceptance

The compact schema is accepted when:

```txt
V3 uses agent_* as the source of truth.
V2 ai_* tables are not expanded.
No redundant specialist/tool/research tables are created by default.
Context packs are compact and hash-reusable.
All AI outputs are artifacts or action drafts.
All approved actions land in global_actions.
All user-owned tables have RLS.
```
