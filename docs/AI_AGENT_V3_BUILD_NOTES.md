# Empire OS V3 — Compact Reasoning Agent: Build Notes

What shipped in `feature/ai-agent-v3-compact-runtime`, how it maps to the V3
design docs, and the tracked follow-ups for items intentionally left out of this
branch.

## What was built

**One runtime, one endpoint, ten tables.** `POST /api/ai/agent/run` infers
intent, builds a compact redacted context pack, reasons (deeply only when stakes
justify it), saves one artifact, and drafts approval-gated actions.

- **Migration** `0014_agent_v3_compact_runtime.sql` — the 10 canonical tables
  (`agent_threads, agent_runs, agent_run_events, agent_context_packs,
  agent_artifacts, agent_action_drafts, agent_memory_items, agent_sources,
  agent_provider_runs, agent_feedback`), all RLS-isolated by `auth.uid()`, with
  practical indexes, idempotency `unique(user_id, idempotency_key)` on runs,
  `unique(run_id, event_order)` on events, and a `context_hash` index. Additive
  only — no V2 `ai_*` table is touched. Intermediate work (capability plans,
  gates, specialist votes, tool runs, source evaluations) is stored as typed
  `agent_run_events`, not separate tables.
- **Services** `src/spine/ai/agent/*` — repository (single persistence layer),
  intent router, context-pack builder (hash-reusable, redacted), memory gate,
  research gate, provider router, specialist council, final synthesizer, action
  draft approval, orchestrator, and read-only V2 adapters.
- **API** `src/app/api/ai/agent/*` — `run`, `action-drafts` (GET list + POST
  batch approve), `action-drafts/[id]/approve`, `memory`, `feedback`, `runs`.
- **UI** `/agent` + `AgentConsole` — one command bar, quick actions, answer +
  Show why + Show sources, and an approve-all / approve / edit / reject draft
  bar. No provider/model/mode pickers. Sidebar gets an **Agent** entry.

## Reuse (no duplication)

V3 reuses, rather than re-implements: the provider abstraction (`callAI`,
`AICredential`), the structured runner (`runStructured` + redaction gate + verify
pass), the redaction utilities, the V2 EmpireContext engine + insight services
(derived facts / prioritizer / feedback) as the context-pack source, user
credential resolution, and the atomic draft→`global_actions` approval pattern.

## Runtime paths

`fast_path` (1 call, no specialists) · `standard_path` (≤1 targeted specialist) ·
`deep_path` (specialist council + grounding verify pass) · `research_required` /
`memory_required` / `approval_required` surface gated states instead of guessing.
Everything degrades to deterministic stubs with no provider key.

## Branch note

The V3 prompt says branch from `develop`; this repo has no `develop` (all prior
V2 work integrated directly to `main`), so this branch was cut from latest
`main`, the effective integration branch.

## Validation

`typecheck` ✅ · `lint` ✅ · `npm test` ✅ (234 passing, +18 V3 tests) · `build` ✅.
CI note: the repo's orphaned "BuildFailed" workflow fails at startup independent
of code — local validation is the gate.

## Follow-ups / Next branch

Everything intentionally out of scope this branch, tracked here so nothing is
lost:

1. **Real research backend.** The research gate returns `research_required` +
   `access_needed` instead of fabricating current facts. Next: wire a real
   web/research capability and persist verified `agent_sources` with credibility/
   recency/relevance scoring.
2. **Re-point V2 surfaces to the runtime.** The V2 AI pages/widgets (Chief of
   Staff, Daily Brief, Recommendations, Module Copilots) still call their V2
   endpoints. Next: route them through `/api/ai/agent/run` via the read adapters,
   then migrate/archive the V2 `ai_*` tables once stable (additive + adapters
   only for now — no destructive churn this branch).
3. **Provider-run retention/cleanup.** Implement the documented retention windows
   (prune noisy fast-path events after 30–90 days; keep deep/research traces
   longer; never store secrets) as a scheduled cleanup.
4. **Async/polling for long deep runs.** `deep_path` responds synchronously now;
   add a queued/polling mode for 15–45s+ runs.
5. **Rate-limit / budget guard** on the expensive `/api/ai/agent/run` path
   (acceptance-checklist item) — currently relies on provider-call caps in the
   strategy; add an explicit per-user budget guard.
6. **Memory promotion from feedback.** `agent_feedback.should_save_as_memory` is
   captured but not yet auto-promoted into `agent_memory_items`.
7. **Specialist-vote → event payloads** could be promoted to a dedicated table
   only if a screen needs to query them directly (per the doc's promotion rule).
