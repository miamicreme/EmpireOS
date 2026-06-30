# Empire OS V3 — AI Runtime Optimization

This document defines what makes the agent faster, cheaper, more accurate, and more useful.

## Runtime Optimization Goals

```txt
Fast when the task is simple.
Deep when the stakes require it.
Honest when facts are missing.
Compact with context.
Structured in outputs.
Logged for improvement.
Safe before external calls.
```

## 1. Context Compression

Never send raw table dumps to a model.

Use a layered context pack:

```txt
Level 1: user objective + current phase + top priorities
Level 2: relevant module snapshots
Level 3: relevant memory
Level 4: recent decisions/reviews/actions
Level 5: source-backed research, only when needed
```

Each layer should have:

```txt
summary
facts
constraints
risks
open questions
source_ids
```

## 2. Retrieval Discipline

The agent should retrieve only what is relevant.

Examples:

```txt
cash command      -> cash entries, cash actions, income targets, today's schedule
job command       -> job apps, recruiter contacts, follow-ups, resume/project memory
funding command   -> credit/funding module, recent credit actions, business docs, current rates if needed
trading command   -> user risk profile, market research request, source verification
politics command  -> current research request, source evaluation, business impact frame
```

## 3. Model Routing

Use routing by task:

```txt
intent classification          fast cheap model or stub
context summarization          fast cheap model or deterministic code
financial strategy             reasoning/deep model
business credit/funding        reasoning/deep model + research gate
stock/trading analysis         deep model + market research + risk critic
political/regulatory analysis  deep model + current research + source scoring
final synthesis high-stakes    strongest available model
```

## 4. Specialist Budgeting

Do not run the full council by default.

```txt
fast_path: 0 specialists
standard_path: 1-2 specialists
deep_path: 3-5 specialists + final synthesizer
```

Hard cap per run unless user explicitly asks for deep mode:

```txt
max provider calls fast_path: 1
max provider calls standard_path: 3
max provider calls deep_path: 7
```

## 5. Cache Strategy

Cache safe intermediate outputs:

```txt
context pack summary
module snapshots
provider health
last daily brief
recent top action ranking
source evaluations
```

Do not cache:

```txt
raw provider hidden reasoning
unredacted sensitive context
stale market/political data as if current
secrets
```

## 6. Research Gates

Research is required when current facts materially change the answer.

The agent should output `research_required` instead of guessing when research is unavailable.

Good behavior:

```txt
I need current market data before giving a trade-quality answer. I created a research request for ticker/news/rates.
```

Bad behavior:

```txt
Here is a confident trade recommendation from stale data.
```

## 7. Memory Gates

Memory is required when durable user context materially changes the recommendation.

Examples:

```txt
risk tolerance unknown for trading
cash target unknown for daily execution
credit goal unknown for funding plan
business entity status unknown for business credit
```

Ask only one or two questions.

## 8. Output Parsability

All AI outputs that drive UI or database writes must be schema-validated.

Required pattern:

```txt
Provider raw text
-> parse structured JSON
-> validate with Zod
-> fallback parser if safe
-> reject or mark partial if invalid
-> persist normalized output
```

## 9. Reasoning Artifacts

Do not store hidden chain-of-thought.

Store:

```txt
problem frame
options considered
assumptions
reasoning summary
risk flags
confidence
source references
specialist votes
final recommendation
```

## 10. Quality Feedback Loop

Every run can improve future behavior through feedback:

```txt
thumbs up/down
wrong because...
save as memory
never suggest this again
this was useful
this needs research next time
```

Persist feedback to `agent_feedback` and optionally memory only after approval.

## 11. Performance Targets

```txt
fast_path p95: under 5 seconds
standard_path p95: under 15 seconds
deep_path p95: under 45 seconds
context pack build: under 1 second for normal data volume
provider router decision: under 500ms
```

## 12. Reliability Targets

```txt
stub mode works with no API keys
provider failure falls back safely
invalid provider JSON does not crash the run
research unavailable returns honest blocked state
memory unavailable returns memory request, not hallucination
approval-only capabilities cannot execute without approval
```
