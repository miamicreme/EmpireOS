# Empire OS — Build Progress & Next Steps

_Last updated: 2026-07-08_

This document tracks what has shipped and what comes next. It complements the
high-level [`MASTER_GUIDE.md`](../MASTER_GUIDE.md) and the architecture docs under
[`architecture/`](./architecture/ARCHITECTURE.md).

---

## 1. Status at a glance

| Layer | Status | Notes |
|-------|--------|-------|
| Repo / docs | ✅ Done | Structure, prompts, runbooks, branching rules |
| Backend spine | ✅ Done | Actions, decisions, metrics, reviews, events, audit |
| Module system | ✅ Done | 6 modules on a uniform `ModuleContract` |
| AI decision engine | ✅ Done | Multi-advisor, redaction-gated, deterministic stub fallback |
| API routes | ✅ Done | Module CRUD + reviews; auth + RLS + Zod on every write |
| Dashboard UI | ✅ Done | Command center: Empire Score, module health, action queue, decisions |
| Module UIs | ✅ Done | All 6 wired to their APIs with optimistic updates |
| AI owner surfaces | ✅ Done in code | `/ai/input`, `/ai/camera`, `/ai/runs/[id]`, `/ai/memory`, `/ai/providers`, `/settings/security` now exist; manual browser proof still pending, and image-byte vision proof is still incomplete |
| AI Teams Core | ✅ MVP slice complete on branch | Templates, active teams, missions, transitions, task generation, review queue, schemas, APIs, and UI pages added on `feature-ai-teams-core` |
| Design system | ✅ Done | Tokens, primitives, motion, toasts, modals, data tables |
| Auth | ✅ Done | Passkey / Face ID (WebAuthn), multi-passkey recovery, route gate |
| Tests | ⚠ Environment-blocked | Typecheck/lint/build pass in this workspace; Vitest is blocked by the installed Node runtime version |
| Deployment | ⏭️ Next | Live Supabase project + hosting + CI |

`main` and `develop` are in sync before the AI Teams feature branch. Current AI UI changes typecheck and build in this workspace; Vitest is blocked by the local Node runtime version, so browser/test proof still needs a compatible runner.

---

## 2. What shipped

### Backend spine
- `AppResult<T>` discriminated-union threaded through every service.
- Typed `AppError` codes mapped to correct HTTP statuses.
- Centralized auth via `requireUserId`; Row Level Security on all 24 tables.
- Action ranking, Empire Score, daily/weekly reviews, system events, audit log.

### Modules (`src/modules/*`)
Cash Engine · Job Hunt · Follow-up CRM · Credit & Funding · Projects · Acquisitions.
Each exposes `getMetrics` / `getActions` / `getDecisionContext` / `getHealth` /
`syncToSpine` plus a validated create/update service.

### AI decision engine
- Multi-advisor panel with a final-judge role.
- **Safety gate**: `assertNoHighRiskSecrets` hard-blocks SSN/EIN/card/IBAN and
  `redactDecisionContext` scrubs PII *before* any external provider call.
- Deterministic stub provider when no API key is configured.

### API surface (`src/app/api/*`)
- Module CRUD: `cash-entries`, `jobs`, `contacts`, `projects`, `credit-items`,
  `acquisitions` (GET list + POST create, PATCH/DELETE by id).
- Reviews: `reviews/daily`, `reviews/weekly` (GET + upsert).
- `middleware.ts` refreshes the Supabase session on every request.
- AI Teams Core feature branch adds:
  - `GET /api/ai/team-templates`
  - `GET /api/ai/teams`
  - `GET/POST /api/ai/missions`
  - `GET/PATCH /api/ai/missions/[id]`

### UI (`src/app`, `src/components`)
- Dark, depth-tinted design system with motion, ambient background, and a
  reusable primitive set: Button, Field, Toast, Modal, Skeleton, StatCard,
  ProgressRing, DataTable, PageHeader, Card, Badge.
- Dashboard command center + all six module pages, each fully wired to its API
  with optimistic deletes, toasts, loading skeletons, and empty states.
- AI owner UI surfaces are now wired in code:
  - `/ai/input` interactive upload/analyze/send-to-agent workbench.
- `/ai/camera` explicit browser camera capture and bounded frame sampling workbench.
- `/ai/runs/[id]` safe run detail surface.
- `/ai/memory` durable memory workbench.
- `/ai/providers` provider health/status surface.
- `/settings/security` owner security posture surface.
- AI Teams Core feature branch adds:
  - `/ai/org`
  - `/ai/team-templates`
  - `/ai/teams`
  - `/ai/missions/[id]`
  - `/ai/review`

### AI Teams Core feature branch
- Added migration `0023_ai_teams_core.sql`.
- Added default system team templates for the first 10 teams.
- Added owner-scoped active team, member, mission, task, message, review, and event tables.
- Added Zod schemas for teams, members, missions, autonomy, priority, mission creation, and mission transitions.
- Added repository service to list templates, instantiate an owner team from a template, create a pending mission, transition missions, generate ready tasks on approval, create review packages, and read mission details.
- Added API routes for templates, teams, missions, mission detail, and mission status transitions.
- Added UI pages for organization chart, templates, active teams, mission detail, and review queue.
- Added schema validation tests.
- Agent execution is intentionally not wired yet; mission tasks remain approval-gated and must route through `POST /api/ai/agent/run` when execution automation is added.

### Quality
- Validation on 2026-07-04:
  - `npm run typecheck` passed.
  - `npm run lint` passed.
- `npm run build` passed.
- `npm test -- --run` is blocked by the workspace Node 20.9.0 runtime; Vitest/rolldown requires a newer Node release.
- `npm audit --omit=dev` reports remaining Next.js/PostCSS vulnerabilities and is not clean.
- Browser camera capture exists, but true camera/image-byte vision analysis still needs live proof before it should be called complete.
- DOCX/XLSX support is still partly parser/metadata driven rather than full native document parsing.
- Passkey enrollment now has a split flow in code: "Add passkey on this device" plus token-backed "Add another device"; manual iPhone proof still needs to be captured.

---

## 3. Suggested next steps

Ordered by leverage.

> **Deploying?** Follow the step-by-step [`DEPLOYMENT.md`](./DEPLOYMENT.md) guide
> (env vars, Vercel, first passkey login).

### A. AI Teams Core validation _(highest product leverage)_
1. Run the new migration against a live/local Supabase project.
2. Run typecheck/lint/build from a compatible Node runtime.
3. Browser-smoke the new pages: `/ai/org`, `/ai/team-templates`, `/ai/teams`, `/ai/missions/[id]`, and `/ai/review`.
4. Create a mission from a template, approve it, confirm tasks generate, send it to review, and confirm the review package appears.
5. Add task-level execution that routes approved mission tasks through `POST /api/ai/agent/run` without creating a second AI subsystem.

### B. Deployment & live data
1. Provision a real Supabase project; run the migrations and seed reference
   tables (`modules`, `empire_phases`). **Do not** put private data in seeds.
2. Configure environment variables in the host (Vercel or similar):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and any AI
   provider keys (server-only).
3. Verify RLS end-to-end against the live project with two test users.

### C. CI / repository hygiene
- **Enable GitHub Actions** for the repo (Settings → Actions / billing). The
  `ci.yml` workflow is valid but every run currently fails at startup for an
  account-level reason, so PRs get no real CI signal today.
- Add an `npm run test` step to the workflow alongside typecheck/lint/build.

### D. Auth & onboarding
- ✅ Passwordless **passkey / Face ID** auth (WebAuthn) is built: first passkey
  claims the owner account, additional passkeys are recovery devices, and the
  app is gated by middleware. Requires `SUPABASE_SERVICE_ROLE_KEY`,
  `WEBAUTHN_ORIGIN`/`WEBAUTHN_RP_ID`, and `OWNER_EMAIL` on the server.
- ⏭️ Onboarding: a first-run profile step to set `daily_cash_target` (the Cash
  Engine already reads it from module metrics).

### E. Feature depth
- **Reviews UI**: build `/reviews/daily` and `/reviews/weekly` pages on the
  existing upsert endpoints (last UI gap).
- **Edit flows**: module pages support create + delete; add inline edit using
  the existing PATCH routes.
- **Decision execution**: surface advisor votes → generated actions more richly
  on the decision detail page; add re-run/refine.
- **Metrics history**: trend sparklines from `getMetricTrend`.

### F. Testing & observability
- Component/interaction tests for the module pages (jsdom + Testing Library).
- E2E smoke test (Playwright is preinstalled) covering login → log cash →
  see Empire Score update.
- Lightweight error logging/telemetry for API routes.

---

## 4. Known issues / watch-list

- **GitHub Actions startup failure** — infra/account-level, not code. Blocks CI
  signal until resolved in repo settings.
- **No live Supabase wiring yet** — the app renders graceful empty states until
  environment variables point at a real project.
- **AI Teams Core has not been runtime-validated in this chat** — branch changes need local/CI typecheck, migration, and API smoke tests.
- **Task execution is not automated yet** — the branch creates teams, missions, tasks, and review packages, but approved task execution still needs a safe bridge into `POST /api/ai/agent/run`.

## Universal input intelligence V7 pass

- Added parser/adaptor service layer for normalized files, documents, spreadsheets, vision inputs, and cost governance.
- Added provider capability routing with explicit `vision_provider_required` failure mode.
- Added Requesty as the preferred OpenAI-compatible AI gateway when configured, while preserving direct provider keys as fallback backup.
- Extended `POST /api/ai/agent/run` orchestration to pull `inputArtifactIds` into the safe context pack as summaries and artifact references.
- Universal input analysis now creates structured artifacts and approval-gated action drafts from documents, spreadsheets, screenshots, camera snapshots, and sampled frame descriptions.
- The camera workflow is browser-real, but the analysis path still needs binary-image proof before it can be described as full vision intelligence.
