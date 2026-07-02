# Backend Completion Report

## Completed in this pass

- Repaired the ActionDraftApprovals contract so tests are green.
- Removed the duplicate per-draft PATCH route.
- Added `GET /api/ai/agent/runs/[id]` with safe summaries only.
- Added memory list/update/delete and approve/reject endpoints on the compact `agent_memory_items` runtime.
- Added `GET /api/ai/providers/health` for secret-free provider readiness.
- Added `GET /api/settings/security/status` for secret-free owner security posture.
- Documented the API contract in `docs/API_CONTRACTS.md`.

## Still intentionally out of scope

- Public SaaS/team/billing/marketplace features.
- A second AI command path or redundant AI tables.
- Universal input/camera intelligence and command-center polish, which belong after backend contracts are merged.
