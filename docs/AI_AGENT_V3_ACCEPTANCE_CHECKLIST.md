

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

# Empire OS V3 AI Agent Acceptance Checklist

Use this checklist before merging `feature/ai-agent-v3` into `develop`.

## Product Acceptance

- [ ] User can type: `What should I do today?`
- [ ] Agent returns a compact direct answer.
- [ ] Agent returns top action drafts.
- [ ] User can approve action drafts into the Spine.
- [ ] Agent detects when memory is missing.
- [ ] Agent suggests memory saves instead of repeatedly asking.
- [ ] Agent detects when current research is required.
- [ ] Agent returns `research_needed` instead of fabricating current facts.
- [ ] Agent runs specialists for high-stakes questions.
- [ ] Specialist votes are persisted.
- [ ] Provider runs are logged.
- [ ] Session and turns are persisted.

## Domain Acceptance

- [ ] Business credit answers include assumptions, documents needed, risk factors, and sequence.
- [ ] Trading answers include time horizon, thesis, invalidation, risk level, position-sizing logic, and fresh-data requirement.
- [ ] Finance answers distinguish cash flow, liquidity, leverage, ROI, and downside.
- [ ] Political/regulatory answers require current sources and stay inside ethical boundaries.
- [ ] Legal/compliance answers do not claim to replace licensed legal advice.

## Safety Acceptance

- [ ] AI cannot send emails/texts without approval.
- [ ] AI cannot apply to jobs without approval.
- [ ] AI cannot place trades or move money.
- [ ] AI cannot submit funding applications automatically.
- [ ] AI cannot bypass auth/RLS.
- [ ] AI cannot expose provider keys.
- [ ] AI cannot persist high-risk unredacted secrets.

## Engineering Acceptance

- [ ] Migration added with RLS policies.
- [ ] Agent schemas use Zod.
- [ ] API routes require auth.
- [ ] Services return AppResult-style results.
- [ ] Existing V2 provider abstraction is reused.
- [ ] Stub mode works with no provider keys.
- [ ] Tests cover low/medium/high-stakes routes.
- [ ] Tests cover research-needed path.
- [ ] Tests cover memory-needed path.
- [ ] Tests cover action draft approval.
- [ ] Docs updated.



## Security Hardening Acceptance

- [ ] Prompt injection tests pass for untrusted source/context snippets.
- [ ] Retrieved research/document content is treated as untrusted data, not instructions.
- [ ] Redaction runs before every provider call.
- [ ] High-risk secrets are blocked, not merely masked.
- [ ] Raw SSNs, full card/account numbers, seed phrases, private keys, and passwords cannot be stored as memory.
- [ ] Provider keys never reach client components, logs, API responses, or persisted artifacts.
- [ ] Expensive AI routes have a rate-limit/budget guard or documented placeholder interface with tests.
- [ ] Provider runs log latency, model, status, fallback, and approximate cost fields.
- [ ] High-stakes recommendations include assumptions, limitations, and risk warnings.

## Speed and Cost Acceptance

- [ ] Low-stakes `fast_path` requests do not run the specialist council.
- [ ] High-stakes requests run only relevant specialists, not every specialist by default.
- [ ] Specialist calls use `Promise.allSettled` or equivalent partial-failure handling.
- [ ] Provider calls have timeouts and fallback behavior.
- [ ] Context packs are compact and intent-filtered.
- [ ] Recent agent session/context reads avoid N+1 query patterns.
- [ ] V3 tables have indexes for user/session/status/created_at access patterns.
- [ ] UI shows staged loading/progress for deep analysis.

## Advanced Intelligence Acceptance

- [ ] Provider router selects based on intent, stakes, freshness, context size, latency, cost, and provider health.
- [ ] Final confidence reflects memory completeness, source freshness, specialist agreement, and risk.
- [ ] Trading/markets answers require fresh data or return `research_needed`.
- [ ] Funding/credit answers include PG exposure, documents needed, lender sequence, and fraud boundary.
- [ ] Political/regulatory answers require current sources and avoid manipulative political persuasion.
- [ ] The agent can say exactly what memory or research would improve its answer.

## Validation Gate

```bash
npm run typecheck
npm run lint
npm test
npm run build
```


---

# Integrated Reasoning Acceptance Gate

V3 is not accepted until these pass:

- [ ] `POST /api/ai/agent/run` is the main entrypoint for one-line AI commands.
- [ ] Fast, standard, deep, memory_required, research_required, and approval_required modes are represented in types and tests.
- [ ] A capability plan is created before tools/providers are used.
- [ ] Unsupported capabilities return `access_needed` instead of fake data.
- [ ] Current market/political/lender/legal/real-estate facts return `research_required` when no current source is available.
- [ ] Stable missing user context returns `memory_required` with no more than two high-leverage questions.
- [ ] Medium/high-stakes runs create a problem frame and reasoning artifact.
- [ ] High-stakes finance/funding/trading/politics/acquisition runs include risk/compliance critic and final judge.
- [ ] External/irreversible actions become approval drafts only.
- [ ] Provider failures are logged and do not kill the entire run when fallback is possible.
- [ ] Prompt injection inside untrusted source content is ignored.
- [ ] Final response includes assumptions and what-would-change-the-answer for complex decisions.
- [ ] No hidden chain-of-thought is returned to the client.
- [ ] Tests prove the agent works as one orchestrated flow, not isolated features.

## Compact Database / No-Churn Acceptance

- [ ] V3 writes to compact `agent_*` tables, not new `ai_*` tables.
- [ ] `agent_run_events` stores plans, gates, specialist votes, tool runs, and source evaluations unless promoted by a clear query need.
- [ ] `agent_artifacts` stores final useful outputs.
- [ ] `agent_action_drafts` stores only approval-ready actions.
- [ ] Context packs use redacted compact payloads, source refs, record refs, and context hashes.
- [ ] Old V2 `ai_*` tables remain readable; no destructive migration in the first V3 branch.
- [ ] The primary command path is `/api/ai/agent/run`.
- [ ] The UI offers low-friction controls: Approve All, Edit, Reject, Go Deeper, Use Research, Save Memory.
