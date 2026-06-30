# Empire OS V3 Provider Routing and Specialist Council Standard

This document defines how Empire OS V3 uses multiple AI providers without wasting time, money, or trust.

## Provider Philosophy

The goal is not to call every model. The goal is to choose the right model path for the job.

```txt
Use fast intelligence for simple execution.
Use deep intelligence for high-stakes judgment.
Use research adapters for current facts.
Use long-context models for large source material.
Use deterministic stubs for tests.
```

## Provider Strategy Object

```ts
export type ProviderStrategy = {
  runtimeClass: 'fast_path' | 'standard_path' | 'deep_path' | 'research_required';
  primaryProvider: 'anthropic' | 'openai' | 'google' | 'stub';
  primaryModel: string;
  fallbackProviders: string[];
  specialists: string[];
  finalJudgeProvider?: string;
  requiresResearch: boolean;
  requiresMemory: boolean;
  maxProviderCalls: number;
  maxLatencyMs: number;
  maxTokensIn: number;
  maxTokensOut: number;
  reason: string;
};
```

## Specialist Council Patterns

### Fast path

```txt
classifier -> one provider -> final response
```

Use for low-stakes admin/execution tasks.

### Standard path

```txt
intent router -> one domain specialist -> final synthesizer
```

Use for cash, job hunt, follow-ups, business planning, projects.

### Deep path

```txt
intent router
-> memory gate
-> research gate
-> 2-5 domain specialists in parallel
-> risk/compliance critic
-> final judge
-> action drafts
```

Use for trading, funding/credit, politics/regulation, legal/compliance, acquisitions, major money moves.

## Specialist Trigger Matrix

| Intent | Specialists |
|---|---|
| execution | execution_operator, final_judge |
| cash | finance_expert, execution_operator, final_judge |
| job_hunt | career_income_strategist, execution_operator, final_judge |
| followup | execution_operator, risk_compliance_officer, final_judge |
| credit_funding | business_credit_expert, finance_expert, risk_compliance_officer, final_judge |
| business_strategy | executive_strategist, finance_expert, execution_operator, final_judge |
| acquisitions | deal_acquisition_strategist, finance_expert, risk_compliance_officer, final_judge |
| stock_trading | markets_trading_analyst, finance_expert, risk_compliance_officer, final_judge |
| politics_regulation | political_regulatory_analyst, risk_compliance_officer, final_judge |
| legal_compliance | risk_compliance_officer, executive_strategist, final_judge |
| project_build | execution_operator, executive_strategist, final_judge |
| memory_update | memory_librarian |
| research_request | research_analyst |

## Output Discipline

Every specialist must return strict JSON. Store the parsed version. If parsing fails:

```txt
1. run one repair attempt
2. if still invalid, store failed vote with status=invalid_output
3. continue with other specialists
4. tell final judge which votes failed
```

## Confidence Handling

Confidence is not vibes. It must consider:

```txt
context completeness
source freshness
specialist agreement
data quality
risk level
provider health
```

High-stakes answers with stale or missing research cannot have high confidence.

## Provider Logging

Every provider run must record:

```txt
session_id
turn_id
specialist_vote_id nullable
provider
model
runtime_class
purpose
status
latency_ms
input_tokens
output_tokens
cost_estimate
error_message nullable
redactions_applied
fallback_used
created_at
```

## Provider Failure Policy

If one provider fails:

```txt
low stakes -> fallback and answer
medium stakes -> fallback and note uncertainty if meaningful
high stakes -> fallback or return degraded answer with explicit provider failure note
research-required -> never fake research if adapter/source unavailable
```

## Cost Discipline

Add configurable defaults:

```env
AI_MAX_PROVIDER_CALLS_FAST=1
AI_MAX_PROVIDER_CALLS_STANDARD=4
AI_MAX_PROVIDER_CALLS_DEEP=8
AI_MAX_CONTEXT_TOKENS_FAST=3000
AI_MAX_CONTEXT_TOKENS_STANDARD=8000
AI_MAX_CONTEXT_TOKENS_DEEP=20000
AI_PROVIDER_TIMEOUT_FAST_MS=8000
AI_PROVIDER_TIMEOUT_STANDARD_MS=20000
AI_PROVIDER_TIMEOUT_DEEP_MS=45000
```

If env values are absent, use safe defaults in code.
