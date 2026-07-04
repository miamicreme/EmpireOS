# EmpireOS Top-Shelf Remaining Work

This checklist continues after the completed Prompt 1 contract repair and the backend-contract pass.

## Current completion status

- [x] Prompt 1 — ActionDraftApprovals contract repair and green tests.
- [x] Backend contract foundation — safe run detail, memory endpoints, provider health, security status, and API docs.
- [ ] Prompt 3 — universal input and camera intelligence.
- [ ] Prompt 4 — private command center polish.

The following owner UI surfaces are now implemented in code, but manual browser proof still needs to be captured:

- `/ai/input`
- `/ai/camera`
- `/ai/runs/[id]`
- `/ai/memory`
- `/ai/providers`
- `/settings/security`

## Remaining Prompt 2 hardening

The backend contract foundation exists, but these items should be hardened before moving to broad UI polish:

- [ ] Add integration tests with mocked Supabase chains for `GET /api/ai/agent/runs/[id]`.
- [ ] Add route tests for memory `GET`, `PATCH`, `DELETE`, and approve/reject behavior.
- [ ] Add route tests for `GET /api/ai/providers/health` to verify no API key, cipher, or secret fields can be returned.
- [ ] Add route tests for `GET /api/settings/security/status` unauthenticated and authenticated cases.
- [ ] Decide whether memory approve/reject should remain status-based on `agent_memory_items` or become explicit memory-request rows/events.
- [ ] Add UI pages for the new backend contracts only after route tests are in place.

## Prompt 3 — universal input and camera intelligence

Keep one AI command path and do not create another AI system.

- [ ] Extend `POST /api/ai/agent/run` input schema to accept analyzed input references without breaking plain text commands.
- [ ] Add secure upload/analyze routes for documents, spreadsheets, images, screenshots, camera snapshots, optional short video frame sampling, and voice-transcript-ready text.
- [ ] Add parser adapters for PDF, DOCX, TXT/MD, CSV/XLSX, and image metadata.
- [ ] Store generated document, spreadsheet, vision, camera, and analysis artifacts in existing `agent_artifacts`.
- [ ] Route all downstream reasoning through the compact `agent_*` runtime.
- [ ] Add local-first spreadsheet analysis for CSV/XLSX summaries before any model call.
- [ ] Add vision provider routing that uses configured provider health and never exposes provider secrets.
- [ ] Add cost governor checks before image/video-heavy analysis.
- [ ] Add redaction before content enters model context or durable memory.
- [ ] Create approval-gated action drafts from analyzed inputs.
- [ ] Ensure camera is never activated silently.
- [ ] Ensure video is not streamed by default; only sample frames with explicit user action.
- [ ] Add manual camera/input checklist covering permission prompt, denied permission, no device, snapshot capture, upload failure, parser failure, and draft creation.

## Prompt 4 — private command center polish

Do not start this before backend and input contracts are tested.

- [ ] Polish `/today` around the canonical action-draft approval UX.
- [ ] Add or refine universal command bar entry points without creating another command path.
- [x] Add `/ai/input` for uploads and analyzed input artifacts. Code complete; manual browser proof pending.
- [x] Add `/ai/camera` for explicit camera snapshot flow. Code complete; manual browser proof pending.
- [x] Add `/ai/runs/[id]` using safe run-detail summaries only. Code complete; manual browser proof pending.
- [x] Add `/ai/memory` over the compact memory endpoints. Code complete; manual browser proof pending.
- [x] Add `/ai/providers` health/status view. Code complete; manual browser proof pending.
- [x] Add `/settings/security` status view. Code complete; manual browser proof pending.
- [ ] Apply premium owner-only command-center polish without public SaaS/team/billing/marketplace features.

## Validation to keep running

Run these before each merge:

```bash
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm audit --omit=dev
```

`npm audit --omit=dev` may need to be run from an environment with registry audit access if this sandbox returns `403 Forbidden`.

## Merge order

1. Prompt 1 contract repair — done.
2. Backend contract hardening and tests — current/next.
3. Universal input and camera intelligence.
4. Private command center polish.
