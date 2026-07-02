# EmpireOS API Contracts

## Canonical AI agent command path

- `POST /api/ai/agent/run` is the only AI command execution path.
- Agent runtime data is stored in compact `agent_*` tables.
- Hidden chain-of-thought, raw prompts, API keys, and high-risk secrets must not be returned to clients.

## Action drafts

- `GET /api/ai/agent/action-drafts` lists pending action drafts.
- `POST /api/ai/agent/action-drafts/[id]/approve` approves or rejects a draft.
- Approval accepts edit-before-approve fields: `title`, `description`, `category`, and `priority`.
- The obsolete `PATCH /api/ai/agent/action-drafts/[id]` route has been removed.

## Agent runs

- `GET /api/ai/agent/runs?threadId=...` returns thread run history.
- `GET /api/ai/agent/runs/[id]` returns a safe run detail view: run summary, event summaries, artifact summaries, action drafts, and provider-run metadata only.
- Run detail responses intentionally exclude event payloads, raw prompts, raw model outputs, hidden chain-of-thought, and secrets.

## Memory

- `GET /api/ai/agent/memory?status=active` lists owner-scoped durable memory.
- `POST /api/ai/agent/memory` saves durable memory after high-risk secret checks.
- `PATCH /api/ai/agent/memory/[id]` updates durable memory after high-risk secret checks.
- `DELETE /api/ai/agent/memory/[id]` soft-deletes memory by marking it `deleted`.
- `POST /api/ai/agent/memory/[id]/approve` marks memory `active` by default or `archived` when `{ "action": "reject" }` is sent.

## Provider health

- `GET /api/ai/providers/health` returns a secret-free provider readiness summary.
- Provider health may expose provider/model identifiers and boolean readiness flags; it must not expose API keys or encrypted key material.

## Security status

- `GET /api/settings/security/status` returns owner-scoped security posture: authentication, passkey count, recovery enabled flag, and a hard `secretValuesReturned: false` marker.
