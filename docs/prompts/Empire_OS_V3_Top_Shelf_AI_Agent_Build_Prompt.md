# Claude Code Prompt — Empire OS V3 Compact No-Friction Reasoning Agent

You are Claude Code working inside the existing Empire OS repo.

You are building **Empire OS V3: Compact No-Friction Reasoning Agent**.

This is the final consolidation pass. Do not build a pile of features. Build one compact end-to-end AI runtime that thinks, gathers data, uses memory/research when needed, reasons through complex problems, creates useful artifacts, and drafts actions for user approval without database bloat or UI friction.

## Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ai-agent-v3-compact-runtime
```

## Read First, In This Order

```txt
README.md
MASTER_GUIDE.md
CLAUDE_BUILD_INSTRUCTIONS.md
.cursorrules
docs/AI_AGENT_V3_DATABASE_COMPACT_PLAN.md
docs/AI_AGENT_V3_GREENFIELD_SCHEMA_PLAN.md
docs/AI_AGENT_V3_NO_FRICTION_RUNTIME.md
docs/AI_AGENT_V3_SOURCE_OF_TRUTH.md
docs/AI_AGENT_V3_END_TO_END_BLUEPRINT.md
docs/AI_AGENT_V3_AI_RUNTIME_OPTIMIZATION.md
docs/AI_AGENT_V3_CONSOLIDATION_MAP.md
docs/AI_AGENT_V3_SECURITY_PERFORMANCE.md
docs/AI_AGENT_V3_PROVIDER_ROUTING.md
docs/AI_AGENT_V3_ACCEPTANCE_CHECKLIST.md
src/spine/ai/*
src/app/api/ai/*
supabase/migrations/*
```

If documents conflict, follow:

```txt
1. AI_AGENT_V3_DATABASE_COMPACT_PLAN.md
2. AI_AGENT_V3_GREENFIELD_SCHEMA_PLAN.md
3. AI_AGENT_V3_NO_FRICTION_RUNTIME.md
4. AI_AGENT_V3_SOURCE_OF_TRUTH.md
5. Existing working code/tests
```

## Mission

Create one low-typing, low-churn, memory-aware, research-aware, provider-routed AI reasoning runtime.

The user should type short commands:

```txt
What today?
Find cash fastest.
Analyze this deal.
Should I trade this?
Fix my funding path.
What politically matters to my business?
Draft my next 5 actions.
Save this as memory.
Go deeper.
```

The agent should infer intent, pull the right internal data, request memory/research only when needed, select the right provider/model, run specialists only when stakes justify it, synthesize a final answer, save one useful artifact, and draft actions for approval.

## Non-Negotiable Core Law

```txt
The Spine owns priority.
Modules own domain detail.
The Agent owns reasoning orchestration.
Memory owns durable user context.
Research owns current/external facts.
Provider Router owns model selection.
Specialists own domain critique when needed.
Final Synthesizer owns the final answer.
Action Drafts own proposed execution.
User approval owns permission to act.
Audit owns accountability.
```

## Compact Source of Truth

Use this canonical compact schema:

```txt
agent_threads          long-running work/conversation containers
agent_runs             one user command + one orchestrated execution
agent_run_events       compact ordered trace: plans, gates, tools, specialists, errors
agent_context_packs    compact redacted context snapshots with hashes and refs
agent_artifacts        final useful outputs: answers, briefs, reports, plans, analyses
agent_action_drafts    approval-ready proposed Spine actions
agent_memory_items     durable approved memory only
agent_sources          external research sources used by runs
agent_provider_runs    provider/model cost, latency, fallback, status logs
agent_feedback         corrections, ratings, accepted/rejected outcomes
```

Do **not** create these by default:

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

Store those as typed `agent_run_events` unless there is a proven query/performance need.

## Required Migration

Create:

```txt
supabase/migrations/0014_agent_v3_compact_runtime.sql
```

Migration requirements:

```txt
create compact agent_* tables
enable RLS on all user-owned tables
add auth.uid() = user_id policies
add practical indexes only
add updated_at triggers where useful
avoid destructive changes
avoid expanding V2 ai_* tables
```

Do not delete V2 tables in this branch. Keep old data readable.

## V2 Compatibility Without Duplication

Existing V2 features may remain, but V3 should write new data to `agent_*` only.

Bridge V2 concepts like this:

```txt
ai_briefs              -> agent_artifacts artifact_type = daily_brief
ai_recommendations     -> agent_artifacts artifact_type = recommendation
ai_action_drafts       -> agent_action_drafts
ai_conversations       -> agent_threads
ai_messages            -> agent_runs + agent_artifacts
ai_usage_events        -> agent_provider_runs + agent_run_events
```

Use adapters/views where needed. Do not create duplicate writes.

## One Command Path

Create one primary endpoint:

```txt
POST /api/ai/agent/run
```

All AI pages/widgets should use this runtime. Specialized pages can pass hints:

```txt
mode_hint
module_hint
artifact_type_hint
runtime_preference
```

But they must not create separate AI systems.

## Required Runtime Flow

```txt
User command
→ agent_thread upsert
→ agent_run create with idempotency key
→ intent router
→ capability planner event
→ permission policy event
→ compact context pack builder
→ memory gate event
→ research gate event
→ provider router
→ specialist council only if needed
→ final synthesizer
→ artifact writer
→ action draft writer if useful
→ feedback/audit loop
```

## Runtime Paths

```txt
fast_path
- low-stakes/simple
- compact or cached context
- one fast provider/stub
- no specialists
- target 2-5 seconds

standard_path
- business/cash/career/project planning
- internal context
- one strong provider
- optional targeted specialist event
- target 5-15 seconds

deep_path
- finance/trading/credit/legal/politics/acquisitions/major money decisions
- specialist council + risk critic + final synthesizer
- research gate if current facts matter
- target 15-45 seconds, async/polling acceptable

research_required
- current facts are required
- use approved research capability or create access_needed state
- do not fake verification

memory_required
- stable user context is missing
- ask one or two highest-leverage questions only

approval_required
- draft actions only
- user must approve before real execution
```

## Write Policy

Always save:

```txt
agent_run
final agent_artifact
provider run summary
```

Save only when needed:

```txt
context pack if changed or important
sources only for research-backed runs
action drafts only when approval is possible
memory only when durable and safe
run events as compact summaries only
```

Never save by default:

```txt
secret/unredacted context
passwords/logins/account numbers/private keys
temporary chain-of-thought
full database dumps
full copied web pages when URL + excerpt is enough
```

## Context Pack Builder

Build compact packs with:

```txt
summary
relevant facts
open risks
current priorities
module signals
source_refs
record_refs
redaction_summary
token_estimate
context_hash
```

Use `context_hash` to reuse context and avoid churn.

Do not send raw module tables to providers.

## Memory Manager

Save durable memory only when it is:

```txt
stable
non-secret
reusable
important for future decisions
confirmed or high-confidence
not already stored in a module table
```

If the fact already exists in a module table, reference that record instead of duplicating it into memory.

## Research Router

Use research only when current/external facts matter.

Research-backed runs must store `agent_sources` with:

```txt
title
url
publisher
published_at
retrieved_at
excerpt
credibility_score
recency_score
relevance_score
metadata
```

Source evaluations can be fields or run events. Do not create a separate evaluation table unless needed.

## Provider Router

The user should not choose models. The router chooses based on:

```txt
risk
complexity
need for current facts
latency budget
cost budget
provider health
fallback availability
```

Track every provider call in `agent_provider_runs`.

## Specialist Council

Use specialists only for deep/high-stakes runs.

Specialist outputs should be stored as `agent_run_events` with `event_type = specialist_vote`.

Possible specialists:

```txt
finance_expert
business_credit_expert
market_trading_analyst
political_regulatory_analyst
deal_acquisition_analyst
career_income_strategist
risk_compliance_critic
execution_operator
final_judge
```

## Artifact Writer

Every useful output becomes one `agent_artifact`.

Artifact types:

```txt
answer
daily_brief
weekly_review
recommendation
strategy_plan
cash_plan
job_strategy
credit_funding_plan
deal_analysis
market_analysis
political_regulatory_brief
research_report
decision_summary
action_plan
```

Do not save the same output in multiple places.

## Action Draft Approval

AI drafts actions. User approves actions.

Action drafts must map cleanly to `global_actions`.

Create or update:

```txt
POST /api/ai/agent/action-drafts/[id]/approve
```

Also support:

```txt
approve selected
approve all
edit then approve
reject
```

Approved drafts become Spine `global_actions`.

## No-Friction UI

Add or update one simple AI command surface.

Controls should be simple:

```txt
Go deeper
Use research
Save memory
Approve all
Approve selected
Edit
Reject
Show why
Show sources
```

Do not expose provider/model/settings complexity to the user.

## Required Services

Create/update compact services only. Prefer fewer, clear services:

```txt
src/spine/ai/agent/agent.types.ts
src/spine/ai/agent/agent.schemas.ts
src/spine/ai/agent/agent-orchestrator.service.ts
src/spine/ai/agent/agent-repository.service.ts
src/spine/ai/agent/intent-router.service.ts
src/spine/ai/agent/context-pack.service.ts
src/spine/ai/agent/memory-gate.service.ts
src/spine/ai/agent/research-gate.service.ts
src/spine/ai/agent/provider-router.service.ts
src/spine/ai/agent/specialist-council.service.ts
src/spine/ai/agent/final-synthesizer.service.ts
src/spine/ai/agent/action-draft-approval.service.ts
src/spine/ai/agent/agent-adapters.service.ts
```

Avoid creating dozens of tiny services unless the existing codebase requires it.

## Tests

Add tests for:

```txt
compact schema repository writes
agent_run idempotency
context_hash reuse
no duplicate artifact writes
V2 adapter mapping
memory not duplicated from module records
research only when needed
specialist votes stored as run events
provider runs logged
action draft approval creates global_actions
RLS/auth protection for new routes
fast_path skips specialist council
standard/deep path routing
```

## Validation

Run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Do not mark complete until validation passes or you clearly document any external/sandbox-only failure.

## Completion Report

Return:

```txt
files created
files modified
migration added
tables added
old ai_* compatibility approach
API routes added
UI updates
runtime paths implemented
tests added
validation result
remaining risks
next branch recommendation
```

## Final Standard

This branch is successful when:

```txt
The agent is one runtime, not feature soup.
The database is compact, not redundant.
The user types less, not more.
The AI reasons deeply only when needed.
The system stores useful artifacts, not noise.
The Spine receives approved actions only.
V2 remains readable with no destructive churn.
```
