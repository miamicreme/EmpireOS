# Empire OS V2 — AI Execution Layer

V2 turns Empire OS from a tracker into an **AI Chief of Staff**. The MVP tracks
the empire; V2 reads the Spine + Modules, decides what matters, and turns it into
ranked, approvable actions.

```
MVP tracks the empire.
V2 thinks with you, ranks actions, drafts them, and watches for risk.
```

## Non-negotiable architecture

AI sits **on top of** the Spine. It never replaces it.

```
The Spine owns priority.
Modules own detail.
Decisions create actions.
Actions move phases.
AI recommends and drafts — the user approves before anything enters the Spine.
```

## Pieces

| Layer | File | Role |
| --- | --- | --- |
| Context Engine | `src/spine/ai/context/empire-context.service.ts` | Gathers profile, phase, empire score, top/overdue actions, per-module health + metrics, recent decisions, and daily/weekly reviews into one typed `EmpireContext`. Degrades gracefully — a failing source yields an empty slice, never a blank context. |
| Context Snapshots | `src/spine/ai/context/context-snapshot.service.ts` | Persists a **redacted** point-in-time `EmpireContext` for auditability. |
| Runner | `src/spine/ai/ai-runner.ts` | Redaction gate → provider call (reuses the existing abstraction) → JSON parse → Zod validation → deterministic stub when no key is set. |
| Chief of Staff | `src/spine/ai/chief-of-staff.service.ts` | Executive summary, ranked top-5 actions, risks, opportunities, focus. Also answers a free-form `question` (Decision Console / Ask Empire OS). |
| Daily Brief | `src/spine/ai/daily-brief.service.ts` | Cash target, top actions, follow-ups due, job/project priority, risks, opportunities, one focus. Upserts into `ai_briefs`. |
| Recommendations | `src/spine/ai/recommendation.service.ts` | Persists ranked recommendations; tracks accept/dismiss over time. |
| Action Drafts | `src/spine/ai/action-draft.service.ts` | The money feature. AI drafts actions; **approval is the only path** that creates a real `global_action`. |
| Module Copilots | `src/spine/ai/module-copilot.service.ts` | Per-module lens (cash / job-hunt / CRM / credit-funding / projects / acquisitions). |

## Safety rules

- AI keys never reach the client. All AI calls run server-side.
- Context is **redacted** (`redactObject` + high-risk-secret assertion) before it
  leaves the system — including before the deterministic stub returns.
- AI may **recommend and draft** only. It cannot send emails, apply to jobs,
  delete records, or mutate money data. Drafts become real actions only after the
  user approves via `POST /api/ai/action-drafts/:id/approve`.
- No provider key required: every feature runs in **stub mode** for local dev and
  tests.

## API

| Route | Purpose |
| --- | --- |
| `GET/POST /api/ai/context` | Build the EmpireContext / persist a snapshot. |
| `GET/POST /api/ai/brief` | Read / generate the daily (or weekly) brief. |
| `POST /api/ai/chief-of-staff` | Daily plan, or answer a `{ question }`. |
| `GET/PATCH /api/ai/recommendations` | List / accept / dismiss. |
| `GET /api/ai/action-drafts` | List drafts (by `?status`). |
| `POST /api/ai/action-drafts/:id/approve` | Approve → create global_action (or `{ reject: true }`). |
| `POST /api/ai/modules/:moduleId/copilot` | Run a module copilot. |

## Database

Migration `supabase/migrations/0011_ai_v2.sql` adds (all RLS-isolated by
`auth.uid()`): `ai_context_snapshots`, `ai_briefs`, `ai_recommendations`,
`ai_action_drafts`, `ai_conversations`, `ai_messages`, `ai_usage_events`.

## Environment

```env
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
AI_DEFAULT_PROVIDER=anthropic
AI_DEFAULT_MODEL=claude-sonnet-4-6
AI_FAST_MODEL=claude-haiku-4-5-20251001
AI_JUDGE_MODEL=claude-sonnet-4-6
```

Model names are configurable; provider keys gate whether a real provider is
called (otherwise stub mode).

## UI

- Dashboard widget: **AI Chief of Staff** (run plan, risks, drafts, ask). Shows a
  derived-facts strip (cash, overdue, done today, open) + momentum chips.
- Pages: `/ai`, `/ai/brief`, `/ai/recommendations`, `/ai/decisions`, `/ai/chat`.
- Each module page carries an **AI Copilot** panel.

## Intelligence layer (V2.1 — "make it smarter")

The AI no longer reads a raw JSON dump and guesses. Five deterministic, fully
unit-tested layers sharpen accuracy and let the system learn:

| Layer | File | What it adds |
| --- | --- | --- |
| Derived facts | `insight/derived-metrics.service.ts` | Computes authoritative numbers in code (cash gap, overdue/due-today counts, completion rate, follow-ups due) so the model never does arithmetic. Exposed as `context.derived`; prompts require using it verbatim. |
| Trends | `insight/derived-metrics.service.ts` | Per-metric direction/delta/streak over a 7-day window (`context.trends`) so the AI reasons about momentum, not just today. |
| Prioritizer | `insight/prioritizer.service.ts` | Deterministic 0–100 priority score with reasons, weighting phase alignment, deadline pressure, today's cash gap, module health, and learned preferences (`context.prioritized`). The AI starts from this baseline; the stub uses it directly. |
| Feedback learning | `insight/feedback.service.ts` | Distills accept/dismiss + approve/reject history into preferred/avoided categories (`context.feedback`), closing the loop so the system adapts to what the operator actually does. |
| Grounding pass | `ai-runner.ts` (`verify`) | An optional second judge-model pass that strips unsupported claims, corrects numbers to `context.derived`, and recalibrates confidence. Enabled on Chief of Staff, Daily Brief, and Module Copilots. |

Net effect: the stub path is now accurate with no model at all, the model is
constrained to grounded facts, and recommendations get better the more the
operator accepts/rejects them.
