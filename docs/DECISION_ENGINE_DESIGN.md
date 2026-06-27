# Decision Engine Design (Backend V3)

The decision engine turns a question into a recorded decision, runs a panel of
AI advisors, and synthesizes a final recommendation. Decisions create actions.

> V3 builds the data structures, service interfaces, and route stubs. Real LLM
> providers are wired in `feature/decision-engine-v3`. No API keys are hardcoded;
> with no provider configured, the panel returns deterministic stub votes so the
> full pipeline is testable.

## Data model

- `decisions` — the question, context, status, recommendation, confidence.
- `decision_options` — candidate options with pros/cons and estimates.
- `decision_votes` — one row per advisor vote (role, recommendation, reasoning,
  confidence, risks, next_actions, `redactions_applied`).

`decision_options` and `decision_votes` are protected by RLS through the parent
`decisions.user_id`.

## Advisors

`src/spine/decisions/advisor.types.ts` defines the panel:

| Role               | Lens                                  |
| ------------------ | ------------------------------------- |
| cash_advisor       | near-term cash generation             |
| career_advisor     | high-income role progression          |
| risk_advisor       | downside, exposure, failure modes     |
| deal_advisor       | acquisition and deal structure        |
| execution_advisor  | sequencing and next steps             |
| final_judge        | synthesis into a recommendation       |

## Orchestration

`src/spine/decisions/decision-orchestrator.service.ts`:

- `buildDecisionContext(...)` — assemble a `DecisionContext` for the decision.
- `redactSensitiveContext(ctx)` — redact, then assert no high-risk secrets.
- `runAdvisorPanel(...)` — produce + persist advisor votes (stub in V3).
- `synthesizeFinalRecommendation(...)` — aggregate votes, finalize the decision.

## Final Judge

In V3 the Final Judge is a simple aggregation of advisor confidences. When a
provider is connected, it becomes a synthesis model that reconciles the panel
into one recommendation with rationale.

## Context redaction

Before anything leaves the system for an external model, context passes through
`context-redaction.service.ts`:

- `redactSensitiveText` / `redactDecisionContext` — pattern-based redaction of
  emails, phones, and PII.
- `assertNoHighRiskSecrets` — throws on SSN / EIN / long account numbers / IBAN.
  This is a hard gate: such secrets never leave the system, even redacted.

## From decision to actions

`createActionsFromDecision` collects `next_actions` from advisor votes and
creates `global_actions` (tagged `source_type=decision`), closing the loop:
decisions create actions, actions move phases.
