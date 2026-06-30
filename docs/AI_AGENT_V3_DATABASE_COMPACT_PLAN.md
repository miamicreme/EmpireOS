# Empire OS V3 — Compact Database + No-Churn Runtime Plan

This document is the final consolidation pass for V3. Its job is to make the agent powerful without turning the database into a pile of overlapping AI tables.

## Goal

Build one compact runtime that can still reason deeply.

```txt
Less table sprawl.
Less duplicate storage.
Less UI friction.
Less repeated context rebuilding.
More useful reasoning.
More traceability.
More speed.
```

## Core Principle

```txt
Store the decision trace, not every temporary thought.
Store durable facts, not every passing idea.
Store compact context, not the whole database.
Store final artifacts, not five duplicate outputs.
Store action drafts only when the user can approve them.
```

The agent can reason through complex problems without permanently saving every intermediate fragment as a first-class table.

## Compact Canonical Schema

Use this as the preferred V3 source-of-truth schema.

```txt
agent_threads          long-running command/conversation containers
agent_runs             one user command + one orchestrated agent execution
agent_run_events       ordered trace events for steps, plans, tools, specialists, gates
agent_context_packs    compact redacted context snapshots used by a run
agent_artifacts        final outputs: answers, briefs, recommendations, reports, analyses
agent_action_drafts    proposed Spine actions waiting for approval
agent_memory_items     durable approved memory only
agent_sources          external sources used for research-backed runs
agent_provider_runs    provider/model cost, latency, fallback, and status logs
agent_feedback         user corrections, ratings, accepted/rejected outcomes
```

That is enough for V3.

## Tables Not Needed by Default

Do not create these as separate first-class V3 tables unless there is a clear query/performance reason:

```txt
agent_turns
agent_steps
agent_capability_plans
agent_memory_requests
agent_research_requests
agent_source_evaluations
agent_specialist_votes
agent_tool_runs
```

Instead, store those as typed rows in `agent_run_events` or structured sections inside `agent_artifacts`.

### Promotion Rule

Only promote an event type into its own table when it meets at least one condition:

```txt
1. It is queried directly on most screens.
2. It needs its own lifecycle independent of the run.
3. It needs heavy indexing for performance.
4. It must be retained longer than the run trace.
5. It has strict permission rules different from the parent run.
```

Until then, keep it inside `agent_run_events`.

## Compact End-to-End Flow

```txt
User command
→ agent_thread
→ agent_run
→ agent_run_events
→ compact context pack
→ memory/research gates if needed
→ provider runs
→ specialist events if deep path
→ final artifact
→ optional action drafts
→ approved drafts become global_actions
→ feedback improves future runs
```

## Write Policy

Every AI call should follow this write policy.

### Always Save

```txt
agent_run
final agent_artifact
agent_provider_runs summary
agent_feedback when user gives it
```

### Save Only When Needed

```txt
agent_context_packs      only when context changed, run is important, or deep_path/research_required
agent_sources            only when current/external research is used
agent_action_drafts      only when actions are actually proposed for approval
agent_memory_items       only when durable memory is approved or clearly safe
agent_run_events         compact events only; no noisy token-by-token trace
```

### Never Save by Default

```txt
full raw prompts with secrets
full raw private context
unredacted bank/account/identity data
temporary chain-of-thought
provider hidden reasoning
entire database snapshots
full copied web pages when excerpt + URL is enough
```

## Context Pack Rules

Context packs should be small, useful, and pointer-based.

A context pack should contain:

```txt
summary
relevant facts
open risks
current priorities
source_refs
record_refs
redaction_summary
token_estimate
context_hash
```

Do not dump every module table into the provider. The agent should pass the provider a compact briefing with references back to internal records.

## Context Hashing

Use a `context_hash` so the system does not rebuild and save the same pack repeatedly.

```txt
same request class + same relevant record versions = reuse context pack
changed record versions = build new context pack
```

This reduces churn, cost, latency, and storage growth.

## Memory Rules

Memory must be durable and useful.

Save memory when it is:

```txt
stable
reusable
non-secret
important for future decisions
confirmed by user or high-confidence from repeated context
```

Do not save memory when it is:

```txt
temporary
sensitive
unverified
available in a module record already
only useful for the current run
```

If the data already lives in a module table, reference it. Do not duplicate it into memory.

## Research Rules

Research should be captured as sources and final artifacts, not scattered tables.

Use `agent_sources` for:

```txt
title
url
publisher
retrieved_at
published_at
excerpt
credibility_score
recency_score
relevance_score
metadata
```

Research requests and source evaluations can be stored as `agent_run_events` unless the UI needs them as standalone records.

## Artifact Rules

`agent_artifacts` is the home for final useful outputs.

Artifact types:

```txt
answer
daily_brief
weekly_review
recommendation
cash_plan
job_strategy
credit_funding_plan
deal_analysis
market_analysis
political_regulatory_brief
business_strategy
research_report
decision_summary
action_plan
```

An artifact should include:

```txt
title
summary
content_json
source_refs
action_draft_refs
confidence
risk_level
created_at
```

## Action Draft Rules

Action drafts are not notes. They are proposed execution.

Only create `agent_action_drafts` when the user can approve them into the Spine.

Each draft should map cleanly into `global_actions`:

```txt
title
description
module_id
priority
urgency
impact
due_at
reason
source_artifact_id
approval_status
```

Approved action drafts become real `global_actions`.

Rejected drafts stay as feedback.

## Compatibility With V2 ai_* Tables

Existing V2 tables can remain, but V3 should not create more `ai_*` tables.

Bridge old V2 features like this:

```txt
ai_briefs              → agent_artifacts where artifact_type = daily_brief
ai_recommendations     → agent_artifacts where artifact_type = recommendation
ai_action_drafts       → agent_action_drafts
ai_conversations       → agent_threads
ai_messages            → agent_runs + agent_artifacts
ai_usage_events        → agent_provider_runs + agent_run_events
```

Use adapters or views so old pages keep working during the transition.

## No-Churn Migration Rule

Do not delete working V2 tables in the first V3 branch.

Use an additive migration:

```txt
0014_agent_v3_compact_runtime.sql
```

Then:

```txt
1. Add compact agent_* tables.
2. Add adapters so V2 endpoints can read V3 artifacts where appropriate.
3. Write new V3 data to agent_* only.
4. Keep old data readable.
5. Migrate or archive later only after production is stable.
```

## Retention + Cleanup

Set retention rules from day one.

```txt
fast_path run events: keep compact summary, prune noisy events after 30-90 days
standard_path run events: keep summary and important trace
deep_path/research runs: keep trace longer
provider runs: keep cost/latency/status, never keep secrets
context packs: keep latest useful packs, compact old packs into summaries
artifacts/action drafts/memory: retain unless user deletes or expires
```

## Performance Rules

Add indexes for the common views only:

```txt
(user_id, created_at desc)
(user_id, status)
(user_id, artifact_type, created_at desc)
(user_id, approval_status, created_at desc)
(user_id, memory_type, status)
(user_id, run_id)
context_hash
```

Avoid indexing every JSON field. Only index fields used by screens or filters.

## Final Standard

V3 is done correctly when:

```txt
There is one agent runtime.
There is one compact schema.
There are no duplicate AI mini-products.
There is no repeated context dumping.
There is no approval friction.
There is no table churn.
The AI can still reason deeply when stakes require it.
```
