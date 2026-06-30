

## Canonical Source-of-Truth Notice

For V3 implementation, the canonical docs are now:

```txt
docs/AI_AGENT_V3_SOURCE_OF_TRUTH.md
docs/AI_AGENT_V3_GREENFIELD_SCHEMA_PLAN.md
docs/AI_AGENT_V3_END_TO_END_BLUEPRINT.md
docs/AI_AGENT_V3_AI_RUNTIME_OPTIMIZATION.md
docs/AI_AGENT_V3_CONSOLIDATION_MAP.md
```

This document supports those files. If there is a conflict, follow `AI_AGENT_V3_SOURCE_OF_TRUTH.md` and update this document.

# Empire OS V3 AI Agent Playbook — Structured Intelligence Layer

## Status

Empire OS already has the MVP and V2 AI layer. V3 is not a rebuild. V3 is the **agentic intelligence layer** that sits on top of the Spine, Modules, Decision Engine, and AI V2 services.

## North Star

Empire OS V3 should feel like a private executive intelligence staff, not a chatbot.

The user should be able to type the least possible, including one-line requests such as:

```txt
What should I do today?
Find cash fastest.
What needs my attention?
Should I make this move?
Run deep research on this.
Save this as memory.
```

The agent must infer intent, gather the right context, identify missing memory, decide whether current research is required, route to the right provider or specialist panel, synthesize a grounded answer, and draft actions for approval.

## Core Law

```txt
The Spine owns priority.
Modules own detail.
AI reads redacted context.
AI asks for memory when context is missing.
AI asks for research when facts may be stale.
AI routes to specialists when stakes are high.
AI drafts actions.
The user approves actions.
Actions move phases.
Phases build the empire.
```

## What V3 Is

V3 is a structured agent system made of ten layers:

```txt
1. Agent Command Interface
2. Intent Router
3. Empire Context Pack Builder
4. Memory Manager
5. Research Router
6. Provider Router
7. Specialist Council
8. Final Synthesizer
9. Approval + Action Draft Layer
10. Learning Loop
```

## What V3 Is Not

V3 is not:

- a generic chatbot
- a motivational quote generator
- a fake financial advisor
- an ungrounded stock picker
- a political persuasion engine
- an agent that takes irreversible actions without approval
- a second AI provider system competing with the existing one

## User Experience Standard

The best V3 response is not long by default. It should be **compressed, decisive, and actionable**:

```txt
Recommendation
Why it matters
Top 3 actions
Risk warning
Missing memory/research if any
Approve action drafts
```

For complex/high-stakes requests, the UI can expose expandable sections:

```txt
Specialist reasoning
Provider confidence
Sources/research needed
Assumptions
Decision log
```

## Intelligence Roles

The agent should simulate a high-quality executive team while staying grounded and safe:

| Role | Purpose | Trigger |
|---|---|---|
| Executive Strategist | Billionaire-path strategy, sequencing, tradeoffs | strategy, priorities, business moves |
| Finance Expert | cash flow, budgets, ROI, debt, liquidity | money, cash, spend, payoff |
| Business Credit Expert | funding readiness, tradelines, PG risk, lender sequence | credit/funding/business credit |
| Markets/Trading Analyst | thesis, risk, invalidation, position-sizing logic | stocks/options/crypto/market questions |
| Political/Regulatory Analyst | policy, regulation, macro/political impact | politics/regulatory/legal changes |
| Deal/Acquisition Strategist | seller finance, valuation, DD, negotiation | acquisitions/real estate/business buys |
| Career/Income Strategist | job hunt, compensation, recruiter moves | employment/income |
| Risk/Compliance Officer | downside, law, ethics, operational risk | high stakes, legal, finance, trades |
| Execution Operator | convert insight into actions | every recommendation |
| Memory Librarian | retrieve/save stable personal context | repeated prefs/goals/context gaps |
| Research Analyst | ask for or ingest current sources | current facts/market/policy |
| Final Judge | reconcile everything into one answer | medium/high stakes |

## Stakes Routing

The agent must classify every request into stakes:

```txt
low: quick admin, simple summaries, drafting, low-impact planning
medium: career, cash planning, business planning, follow-ups, deal triage
high: trading, funding/credit strategy, legal/compliance, political/regulatory analysis, acquisitions, major cash commitments, irreversible actions
```

Routing rules:

```txt
low stakes -> fast provider + existing context
medium stakes -> relevant specialists + final synthesizer
high stakes -> specialist council + risk/compliance + final judge + memory/research gate
current-data tasks -> research router before final answer
```

## Provider Strategy

Use the existing provider abstraction. Do not create a separate provider stack.

Provider intent:

| Provider type | Best use |
|---|---|
| Anthropic / Claude | deep executive reasoning, final synthesis, nuanced tradeoffs |
| OpenAI reasoning models | math-heavy finance, trading analysis, adversarial review |
| OpenAI fast models | extraction, classification, short drafts |
| Google Gemini | long-context document synthesis, big files, broad summaries |
| Research adapters: Perplexity/Tavily/Exa placeholders | current web research and citations |
| Stub/local | deterministic tests and offline development |

Do not call every provider every time. Route based on:

```txt
intent
stakes
freshness requirement
context size
latency
cost
provider health
```

## Memory Rules

The agent should be smart enough to know when it needs more memory.

Memory types:

```txt
profile
preference
goal
constraint
financial_context
credit_context
trading_risk_profile
business_context
relationship
decision_pattern
accepted_strategy
rejected_strategy
source_reference
```

The agent should request memory when a missing fact materially changes the answer.

Examples:

```txt
Trading question -> ask for/save risk tolerance, account size range, time horizon, max loss rules.
Funding question -> ask for/save entity status, revenue, credit profile, PG tolerance, banking relationships.
Political/regulatory question -> ask for/save geography, industry exposure, business impact.
Career question -> ask for/save target comp, location, resume version, recruiter preferences.
```

The agent should not ask ten questions. It should ask the **one or two highest-leverage questions** or continue with explicit assumptions.

## Research Rules

The agent must know when internet/current research is required.

Require fresh research for:

```txt
stock prices, options chains, market-moving news, earnings, SEC filings
interest rates, lender terms, credit/funding products
political/regulatory/legal changes
current real estate comps, active listings, market rents
competitor or company facts that may have changed
funding/grant programs
anything likely changed after the model's knowledge window
```

If research tools are not available, the agent must return a structured state:

```txt
research_needed: true
reason: why current sources are required
sources_needed: exact source types
minimum_source_quality: primary/official preferred
can_continue_with_assumptions: yes/no
```

It must not pretend current facts are verified without sources.

## Domain Guardrails

### Finance and business credit

The agent may analyze cash flow, funding readiness, business credit sequencing, underwriting assumptions, and lender-fit strategy. It must not guarantee approvals or recommend fraud, synthetic identity tactics, misrepresentation, or unsafe leverage.

### Trading and markets

The agent may provide thesis structure, risk framework, position-sizing logic, invalidation conditions, and research requirements. It must require fresh data for market/current-trading calls and must not place trades or guarantee returns.

### Politics and regulation

The agent may analyze policy, regulation, macro impact, stakeholders, and business exposure. It must not generate deceptive persuasion, targeted voter manipulation, or unsupported claims about current political facts.

### Legal/compliance

The agent may provide issue-spotting, compliance planning, and questions for counsel. It must not present itself as a lawyer or replace licensed advice.

## Data Model Additions

Create the next migration after the current highest migration.

Tables:

```txt
ai_agent_sessions
ai_agent_turns
ai_memory_items
ai_memory_requests
ai_research_requests
ai_research_sources
ai_provider_runs
ai_specialist_votes
ai_agent_artifacts
```

Every user-owned table must include:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
created_at timestamptz not null default now(),
updated_at timestamptz
```

Enable RLS and add user policies:

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

## Service Structure

Create the V3 agent under:

```txt
src/spine/ai/agent/
```

Core services:

```txt
agent.types.ts
agent.schemas.ts
intent-router.service.ts
context-pack.service.ts
memory-manager.service.ts
research-router.service.ts
provider-router.service.ts
specialist-panel.service.ts
final-synthesizer.service.ts
agent-session.service.ts
agent-orchestrator.service.ts
```

Support services:

```txt
src/spine/ai/memory/
src/spine/ai/research/
src/spine/ai/providers/
src/spine/ai/specialists/
```

Reuse existing V2 services:

```txt
buildEmpireContext
runStructured
callAI
recordAiUsage
createActionDrafts
redactObject
assertNoHighRiskSecrets
provider config services
```

## Agent Orchestrator Flow

```txt
runEmpireAgent(supabase, userId, input)
  -> validate input
  -> start/load session
  -> build EmpireContext
  -> classify intent/stakes
  -> load relevant memory
  -> detect missing memory
  -> detect research need
  -> if research required and unavailable: create research request + return research_needed state
  -> route provider strategy
  -> run specialist council if needed
  -> run final synthesizer
  -> draft actions where appropriate
  -> save turn/artifacts/provider logs
  -> return compact UI-ready answer
```

## API Routes

Create:

```txt
src/app/api/ai/agent/run/route.ts
src/app/api/ai/agent/sessions/route.ts
src/app/api/ai/agent/sessions/[id]/route.ts
src/app/api/ai/agent/sessions/[id]/turns/route.ts
src/app/api/ai/memory/route.ts
src/app/api/ai/memory/[id]/route.ts
src/app/api/ai/research/requests/route.ts
src/app/api/ai/research/requests/[id]/route.ts
src/app/api/ai/research/requests/[id]/complete/route.ts
src/app/api/ai/provider-router/test/route.ts
```

All routes must:

```txt
require authenticated user
use RLS-safe Supabase client by default
validate input with Zod
return AppResult-style JSON
never expose provider keys
never persist high-risk unredacted secrets
```

## Low-Typing UI

Create:

```txt
src/app/ai/agent/page.tsx
src/app/ai/memory/page.tsx
src/app/ai/research/page.tsx
src/app/ai/provider-router/page.tsx
```

Components:

```txt
AgentCommandBar
AgentResponsePanel
AgentQuickActions
MemoryRequestCard
ResearchRequestCard
SpecialistVotesPanel
ProviderConfidencePanel
ActionDraftApprovalBar
AgentSessionTimeline
```

One-tap commands:

```txt
Plan my day
Find cash fastest
What needs my attention?
What should I ignore?
Run deep research
Save this as memory
Review risks
Draft actions
```

## Answer Contract

All agent responses must include this structured contract:

```ts
{
  mode: 'answer' | 'research_needed' | 'memory_needed' | 'approval_needed' | 'error'
  executiveSummary: string
  directAnswer: string
  recommendedFocus?: string
  topActions: ActionDraftCandidate[]
  risks: string[]
  opportunities: string[]
  missingMemory: string[]
  researchNeeded: ResearchNeed[]
  assumptions: string[]
  confidence: number
  specialistVotes?: SpecialistVoteSummary[]
  providerRuns?: ProviderRunSummary[]
}
```

## Tests

Add tests for:

```txt
intent router
stakes classification
memory manager
research router
provider router
specialist panel in stub mode
final synthesizer schema
orchestrator low-stakes path
orchestrator high-stakes path
research-needed path
memory-needed path
action draft approval path
API auth protection
RLS-safe assumptions
no provider key required in stub mode
no unredacted high-risk secrets persist
```



## Security, Speed, and Advanced Routing Addendum

V3 must implement the hardening and performance standards in:

```txt
docs/AI_AGENT_V3_SECURITY_PERFORMANCE.md
docs/AI_AGENT_V3_PROVIDER_ROUTING.md
```

These files are part of the acceptance gate, not optional reading.

### Secure-by-default requirements

```txt
redaction before provider calls
prompt-injection defense for retrieved context
RLS/auth on every route
Zod validation on every input/output
provider keys server-side only
AI cost/latency logging
action approval before external/irreversible actions
no raw high-risk secret memory persistence
```

### Fast-by-default requirements

```txt
fast_path for low-stakes execution
standard_path for normal business/cash/career planning
deep_path only for high-stakes work
research_required for current facts
parallel specialist calls with Promise.allSettled
timeouts and fallbacks for provider calls
compact context packs instead of raw database dumps
indexes on V3 agent tables
```

### Advanced intelligence requirements

```txt
specialist council only when useful
risk/compliance critic for high-stakes answers
final judge synthesis
confidence based on data freshness and specialist agreement
explicit assumptions
memory/research cards when context is insufficient
provider run logs for auditability
```

## Acceptance Criteria

V3 is complete only when:

```txt
A user can type: What should I do today?
The agent loads context.
The agent knows if memory is missing.
The agent knows if research is required.
The agent routes providers intelligently.
The agent runs specialists when stakes are high.
The agent returns a compact answer.
The agent drafts actions.
The user can approve actions into the Spine.
The turn is saved.
Provider runs are logged.
Tests pass.
Build passes.
Docs are updated.
```


---

# Integration Pass Requirement — One Agentic Operating Loop

V3 must work as one integrated reasoning system, not a bundle of disconnected features.

Before implementation is accepted, Claude/Cursor must also follow:

```txt
docs/AI_AGENT_V3_SYSTEM_INTEGRATION.md
docs/AI_AGENT_V3_CAPABILITY_CONTROL_PLANE.md
docs/AI_AGENT_V3_COMPLEX_REASONING_PROTOCOL.md
```

The main orchestrator is mandatory:

```txt
POST /api/ai/agent/run -> runEmpireAgent()
```

All V3 behavior should flow through or be reusable by the main orchestrator:

```txt
Intent Router
Capability Planner
Context Pack Builder
Memory Manager
Research Router
Provider Router
Specialist Council
Final Synthesizer
Action Draft Approval
Audit + Learning Loop
```

## No Feature Soup Acceptance Rule

A V3 feature is incomplete unless it plugs into:

```txt
Agent Orchestrator
Capability Control Plane
Memory/Research Gates
Provider Router
Action Draft Approval
Audit/Usage Logs
```

## Complex Problem Standard

For finance, business credit, trading, politics/regulation, acquisitions, and major career/income decisions, V3 must create a problem frame and reasoning artifact with:

```txt
objective
constraints
known facts
unknowns
required data
assumptions
evidence
options
risks
recommendation
what would change the answer
action drafts
```

Do not expose hidden chain-of-thought. Show a concise reasoning summary, assumptions, evidence, option scores, decision log, and confidence.
