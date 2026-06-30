# Empire OS V3 — Agent Source of Truth

This file is the canonical source of truth for the V3 AI Agent implementation.

If another V3 document conflicts with this one, follow this document first, then update the conflicting document.

## 1. Product Definition

Empire OS V3 is not a collection of AI features. It is one integrated reasoning and control system on top of the existing Empire OS Spine.

```txt
MVP tracks the empire.
V2 adds AI briefs, recommendations, and action drafts.
V3 becomes the integrated reasoning agent that can understand intent, gather context, request memory, request research, select providers, run specialists, synthesize, and draft controlled actions.
```

The user should type as little as possible. The agent should infer the missing structure, but it must not invent missing facts.

## 2. Core Law

```txt
The Spine owns priority.
Modules own domain detail.
The Agent owns reasoning orchestration.
Memory owns durable user context.
Research owns current/external facts.
Provider Router owns model selection.
Specialists own domain critique.
Final Synthesizer owns the final answer.
Action Drafts own proposed execution.
User approval owns permission to act.
Audit owns accountability.
```

## 3. One-Brain Runtime

Every intelligent request must route through one runtime path:

```txt
User Command
  -> Agent Orchestrator
  -> Intent Router
  -> Capability Planner
  -> Context Pack Builder
  -> Memory Gate
  -> Research Gate
  -> Provider Router
  -> Specialist Council, if needed
  -> Final Synthesizer
  -> Action Draft Approval
  -> Agent Run Log
  -> Learning/Audit Loop
```

Do not build isolated AI services that bypass this path.

Legacy V2 routes can remain, but shared logic must call the V3 orchestration services or a thin adapter around them.

## 4. Canonical Runtime Entities

The canonical runtime source of truth is:

```txt
agent_sessions        conversation / work stream container
agent_turns           one user input + agent response cycle
agent_runs            one orchestrated reasoning execution
agent_steps           ordered trace of what the run did
agent_context_packs   compact structured internal context used by the run
agent_memory_items    durable, approved user/business memory
agent_memory_requests requests for missing durable context
agent_research_requests requests for current/external research
agent_sources         sources attached to completed research
agent_source_evaluations source quality/risk scoring
agent_provider_runs   provider/model calls, cost, latency, confidence
agent_specialist_votes specialist panel outputs
agent_artifacts       structured outputs: brief, recommendation, analysis, plan, draft, report
agent_action_drafts   proposed global_actions awaiting approval
agent_feedback        user feedback for learning and tuning
```

Greenfield builds should use these canonical entities.

Existing V2 tables such as `ai_briefs`, `ai_recommendations`, `ai_action_drafts`, and `ai_context_snapshots` may remain for compatibility, but new V3 code should not create a second competing source of truth. Use adapters, views, or migration bridges.

## 5. Runtime Modes

The agent must choose the cheapest safe mode that can answer correctly.

```txt
fast_path
- simple request
- low stakes
- compact context
- one fast provider or stub
- no specialist council
- target 2-5 seconds

standard_path
- normal business/cash/career/project planning
- internal context needed
- maybe 1-2 specialists
- target 5-15 seconds

deep_path
- finance, business credit, trading, legal, politics, acquisitions, major money decisions
- specialist council + risk/compliance critic + final synthesizer
- source checks if current facts matter
- target 15-45 seconds

research_required
- current market, policy, law, rate, stock, company, financing, or political fact is material
- create research request or call approved research capability
- do not fake verification

memory_required
- missing durable personal/business context materially affects the answer
- ask one or two highest-leverage questions only

approval_required
- proposed action changes state, contacts people, files something, spends money, modifies records, or creates external effects
- draft first; user approves later
```

## 6. Capability Control Plane

The agent can plan capabilities, but permission policy decides whether it can execute them.

Capability classes:

```txt
read_internal_data        safe with auth/RLS
write_internal_draft      safe if reversible and marked draft
create_spine_action       approval required unless user explicitly approves in the same request
external_research         allowed only through configured provider/research connector and logged
financial_analysis        allowed with disclaimers and source quality checks
trading_analysis          deep_path; no guarantees; never execute trades
credit/funding_strategy   deep_path; no fake underwriting certainty
political/regulatory      research_required for current claims
send_external_message     approval required
spend_money               approval required; normally not implemented
irreversible_delete       blocked unless explicit dedicated flow exists
```

## 7. Specialist Council

Use specialists only when warranted. Do not run every specialist on every request.

Canonical specialists:

```txt
executive_strategist
finance_cfo
business_credit_funding
markets_trading
politics_policy
risk_compliance
deal_acquisitions
career_income
execution_operator
memory_librarian
research_analyst
final_synthesizer
```

High-stakes domains require at least:

```txt
primary domain specialist
risk_compliance
final_synthesizer
```

## 8. Provider Strategy

The provider router must select by task, not brand preference.

The agent should use:

```txt
fast model       for routing, summarization, extraction, low-stakes drafts
reasoning model  for hard strategy, finance, negotiations, complex decisions
deep model       for final synthesis on high-stakes problems
stub provider    for tests and local validation without keys
```

Every provider call must log:

```txt
provider
model
purpose
runtime_mode
tokens/cost if available
latency_ms
success/failure
fallback_used
redaction_applied
```

## 9. Context Pack Standard

Do not send the whole database to an LLM.

Build compact context packs with:

```txt
user objective
current phase
top open actions
overdue actions
cash snapshot
job/career snapshot
follow-up snapshot
credit/funding snapshot
project snapshot
acquisition snapshot
recent decisions
recent briefs/reviews
relevant memory
research status
constraints
known unknowns
```

All context packs must pass security/redaction before provider calls.

## 10. Memory Standard

Memory must be useful, durable, and safe.

Save as memory only when the fact is stable and likely useful later:

```txt
personal preference
business strategy
financial constraint
credit/funding rule
project priority
contact relationship
recurring workflow
risk tolerance
long-term goal
```

Do not store:

```txt
raw SSN/card/account/private keys
one-time temporary facts
unverified gossip
sensitive data that should remain in source systems
provider raw chain-of-thought
```

## 11. Research Standard

The agent must know when it needs current facts.

Research is required for:

```txt
stock prices, market conditions, options/trading setups
interest rates, credit offers, lending rules
current politics/policy/regulation
company/news verification
legal/compliance claims that may have changed
real estate listing status/cap rates if current
current AI/provider/API changes
```

If web/research capability is unavailable, the agent must say so and ask the user to provide sources or enable research.

## 12. Output Standard

The final answer should be practical and action-oriented.

For complex problems, output:

```txt
answer
confidence
what data was used
what is uncertain
reasoning summary, not hidden chain-of-thought
risks
upside
recommended actions
action drafts requiring approval
memory/research requests if needed
```

## 13. Acceptance Gate

V3 is not accepted until:

```txt
one central run endpoint exists
one canonical runtime schema exists
low-typing command bar uses the orchestrator
agent can choose fast/standard/deep/research/memory/approval modes
agent can produce action drafts, not just text
agent logs provider runs and specialist votes
agent handles missing memory and missing research honestly
agent does not bypass RLS/auth/redaction
all tests pass
build passes
```

## Final Compact Database Rule

The final V3 source of truth is the compact `agent_*` runtime defined in:

- `docs/AI_AGENT_V3_DATABASE_COMPACT_PLAN.md`
- `docs/AI_AGENT_V3_GREENFIELD_SCHEMA_PLAN.md`
- `docs/AI_AGENT_V3_NO_FRICTION_RUNTIME.md`

When documents conflict, follow the compact database plan first. The agent should not create a separate table for every intermediate reasoning concept. Most intermediate work belongs in `agent_run_events` and final useful work belongs in `agent_artifacts` or `agent_action_drafts`.
