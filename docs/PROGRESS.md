# Empire OS — Build Progress & Next Steps

_Last updated: 2026-06-29_

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
| Design system | ✅ Done | Tokens, primitives, motion, toasts, modals, data tables |
| Auth | ✅ Done | Passkey / Face ID (WebAuthn), multi-passkey recovery, route gate |
| Tests | ✅ 181 passing | Pure logic, schemas, redaction, module metrics, API routes, auth config |
| Deployment | ⏭️ Next | Live Supabase project + hosting + CI |

`main` and `develop` are in sync. Every merged change passes `npm run typecheck`,
`npm run build`, and `npm test` locally.

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

### UI (`src/app`, `src/components`)
- Dark, depth-tinted design system with motion, ambient background, and a
  reusable primitive set: Button, Field, Toast, Modal, Skeleton, StatCard,
  ProgressRing, DataTable, PageHeader, Card, Badge.
- Dashboard command center + all six module pages, each fully wired to its API
  with optimistic deletes, toasts, loading skeletons, and empty states.

### Quality
- 175 tests: result/errors/dates, action ranking, Empire Score, context
  redaction, advisor prompts, provider selection, schemas, module metrics,
  module-schema null-handling, and API route integration (auth, tenant
  scoping, validation, error mapping).

---

## 3. Suggested next steps

Ordered by leverage.

> **Deploying?** Follow the step-by-step [`DEPLOYMENT.md`](./DEPLOYMENT.md) guide
> (env vars, Vercel, first passkey login).

### A. Deployment & live data _(highest priority)_
1. Provision a real Supabase project; run the migrations and seed reference
   tables (`modules`, `empire_phases`). **Do not** put private data in seeds.
2. Configure environment variables in the host (Vercel or similar):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and any AI
   provider keys (server-only).
3. Verify RLS end-to-end against the live project with two test users.

### B. CI / repository hygiene
- **Enable GitHub Actions** for the repo (Settings → Actions / billing). The
  `ci.yml` workflow is valid but every run currently fails at startup for an
  account-level reason, so PRs get no real CI signal today.
- Add an `npm run test` step to the workflow alongside typecheck/lint/build.

### C. Auth & onboarding
- ✅ Passwordless **passkey / Face ID** auth (WebAuthn) is built: first passkey
  claims the owner account, additional passkeys are recovery devices, and the
  app is gated by middleware. Requires `SUPABASE_SERVICE_ROLE_KEY`,
  `WEBAUTHN_ORIGIN`/`WEBAUTHN_RP_ID`, and `OWNER_EMAIL` on the server.
- ⏭️ Onboarding: a first-run profile step to set `daily_cash_target` (the Cash
  Engine already reads it from module metrics).

### D. Feature depth
- **Reviews UI**: build `/reviews/daily` and `/reviews/weekly` pages on the
  existing upsert endpoints (last UI gap).
- **Edit flows**: module pages support create + delete; add inline edit using
  the existing PATCH routes.
- **Decision execution**: surface advisor votes → generated actions more richly
  on the decision detail page; add re-run/refine.
- **Metrics history**: trend sparklines from `getMetricTrend`.

### E. Testing & observability
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
