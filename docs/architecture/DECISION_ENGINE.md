# AI Decision Engine

The Decision Engine is a **multi-advisor** system. It turns context into decisions, and **decisions create actions**.

## Purpose

- Gather context from the Spine and Modules.
- Redact sensitive/private context before any external AI call.
- Run multiple advisors, each offering an independent perspective.
- Reconcile advisor outputs into one Final Judge recommendation.
- Persist advisor votes for auditability.
- Finalize the decision and optionally create Global Actions on the Spine.

## Multi-Advisor Panel

The standard Empire OS advisor panel is:

```txt
Cash Advisor
Career Advisor
Risk Advisor
Deal Advisor
Execution Advisor
Final Judge
```

Each non-judge advisor evaluates the same redacted decision context through a distinct lens. The Final Judge receives the panel votes and synthesizes one recommendation.

## Runtime Flow

```txt
Decision row
  -> buildDecisionContext()
  -> redactSensitiveContext()
  -> runAdvisorPanel()
  -> persist decision_votes
  -> synthesizeFinalRecommendation()
  -> finalizeDecision()
  -> optional createActionsFromDecision()
```

Decision flow principle:

```txt
Context -> Advisors -> Votes -> Final Judge -> Decision -> Actions -> Spine
```

## Implementation Files

```txt
src/spine/decisions/advisor.types.ts
src/spine/decisions/decision-orchestrator.service.ts
src/spine/decisions/decision.service.ts
src/spine/decisions/context-redaction.service.ts
src/spine/ai/provider.ts
src/spine/ai/advisor-prompts.ts
src/app/api/decisions/[decisionId]/analyze/route.ts
```

## API Endpoint

Run a decision analysis:

```http
POST /api/decisions/:decisionId/analyze
```

Body:

```json
{
  "createActions": true
}
```

If `createActions` is true, the system creates Global Actions from advisor `next_actions` after finalizing the decision.

## Provider Strategy

The AI provider abstraction selects the best available provider at runtime:

```txt
Anthropic -> OpenAI -> Google -> stub
```

If no API key is configured, the system uses a stub provider so the full flow remains testable.

Required environment variables are optional per provider:

```txt
ANTHROPIC_API_KEY
OPENAI_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY
```

## Redaction Rule

No raw decision context reaches an external AI provider without passing through the redaction gate.

Redacted or blocked data includes:

```txt
SSNs
EINs
full account/card numbers
IBANs
emails
phone numbers
other PII patterns
```

High-risk secrets block the external call instead of merely being redacted.

## Decision States

```txt
draft -> analyzing -> decided
```

Terminal or protected states:

```txt
analyzing
archived
decided
```

The orchestrator refuses to analyze decisions already being analyzed, archived, or decided.

## Auditability

Advisor outputs are stored in `decision_votes` with:

```txt
advisor_name
advisor_role
model_name
recommendation
reasoning
confidence
risks
next_actions
redactions_applied
```

## Next Work

- Enrich `buildDecisionContext()` with module registry context.
- Add dashboard UI for decision creation and analysis.
- Add decision history/detail page.
- Add tests for redaction, provider fallback, and invalid-state handling.
