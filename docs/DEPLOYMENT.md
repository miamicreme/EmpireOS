# Empire OS — Deployment Guide

How to take Empire OS live and register your first passkey. The recommended
host is **Vercel** (first-class Next.js App Router support); any Node host works.

This guide covers two paths:

- **Existing project** — if you already have the `EmpireOS` Supabase project
  provisioned and migrated, skip to [§2 Environment variables](#2-environment-variables).
- **Fresh project** — if you are starting from a brand-new Supabase project,
  begin at [§1 Supabase setup](#1-supabase-setup-fresh-project-only).

---

## 1. Supabase setup _(fresh project only)_

> Skip this section if your Supabase project is already migrated (25 tables, RLS
> applied). Jump straight to [§2](#2-environment-variables).

### 1a. Create the project

1. Sign in to [supabase.com](https://supabase.com) → **New project**.
2. Name it `EmpireOS`, choose a region, set a strong DB password. Note the
   **Project URL** and **anon key** shown after creation.

### 1b. Apply migrations

All migrations live in `supabase/migrations/`. Apply them in order (0001 → 0010):

**Option A — Supabase CLI** (recommended for local dev):
```bash
# Link to your project (run once)
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

**Option B — Dashboard SQL editor**:
Open each file in `supabase/migrations/` and paste + run the SQL in
**Supabase → SQL Editor** in ascending order (0001 first, 0010 last).

### 1c. Seed reference tables

After migrations, seed the two reference tables the app reads at startup:

```sql
-- Run in Supabase SQL editor
INSERT INTO public.modules (id, name, slug, description, icon, sort_order) VALUES
  (gen_random_uuid(), 'Cash Engine',    'cash-engine',    'Daily cash flow tracking',   '💵', 1),
  (gen_random_uuid(), 'Job Hunt',       'job-hunt',       'Job application tracker',    '🎯', 2),
  (gen_random_uuid(), 'Follow-up CRM',  'followup-crm',   'Relationship management',    '🤝', 3),
  (gen_random_uuid(), 'Credit & Funding','credit-funding', 'Credit and funding tracker', '💳', 4),
  (gen_random_uuid(), 'Projects',       'projects',       'Project execution tracker',  '🏗️', 5),
  (gen_random_uuid(), 'Acquisitions',   'acquisitions',   'Deal pipeline',              '🏢', 6)
ON CONFLICT DO NOTHING;

INSERT INTO public.empire_phases (id, name, slug, sort_order) VALUES
  (gen_random_uuid(), 'Foundation', 'foundation', 1),
  (gen_random_uuid(), 'Growth',     'growth',     2),
  (gen_random_uuid(), 'Scale',      'scale',      3),
  (gen_random_uuid(), 'Empire',     'empire',     4)
ON CONFLICT DO NOTHING;
```

After migrations and seeding, run **Database → Advisors → Security** in the
Supabase dashboard — it should report zero lint warnings.

---

## 3. Environment variables

Set these on the host (Vercel → Project → Settings → Environment Variables).
**Never commit them.** The service-role key and AI keys are server-only secrets.

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` key | Public, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | **Secret.** Server-only |
| `WEBAUTHN_ORIGIN` | Your full site origin | e.g. `https://empire.yourdomain.com` |
| `WEBAUTHN_RP_ID` | Your bare host | e.g. `empire.yourdomain.com` (no scheme/port) |
| `WEBAUTHN_RP_NAME` | Display name | e.g. `Empire OS` |
| `OWNER_EMAIL` | Your email | Internal identity for the owner account |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Absent → decision engine runs in deterministic stub mode |

> **Passkey gotcha:** `WEBAUTHN_RP_ID` must equal the site's registrable domain
> exactly, or the browser refuses to create/use passkeys. Use the bare host
> (`empire.yourdomain.com`), no `https://`, no port. For local dev use
> `localhost` with `WEBAUTHN_ORIGIN=http://localhost:3000`.
>
> A passkey registered on one `WEBAUTHN_RP_ID` will **not** work on another, so
> pick the production domain before registering your first passkey.

---

## 4. Deploy to Vercel

1. Push `main` to GitHub (already done).
2. In Vercel: **New Project → Import** the `miamicreme/EmpireOS` repo.
3. Framework preset: **Next.js** (auto-detected). Build command `next build`,
   output handled automatically.
4. Add all environment variables from section 3 (Production scope).
5. **Deploy.**
6. Add your custom domain under **Settings → Domains** and confirm
   `WEBAUTHN_ORIGIN` / `WEBAUTHN_RP_ID` match it. Redeploy if you change them.

### Self-hosted alternative

```bash
npm ci
npm run build
npm start            # serves on $PORT (default 3000) — put behind HTTPS
```

Passkeys require a **secure context** (HTTPS), except on `localhost`. Terminate
TLS at your proxy and set `WEBAUTHN_ORIGIN`/`WEBAUTHN_RP_ID` to the public host.

---

## 5. First login (claim the owner account)

1. Open your deployed site → you'll be redirected to `/login`.
2. Tap **Create passkey** → approve with Face ID / Touch ID / Windows Hello.
   This first passkey claims the single owner account.
3. You're in. Go to **Passkeys** (sidebar) and **Add passkey** on a second
   device (e.g. your phone) so you have a recovery key — removing your only
   passkey is blocked by design.

If `/login` shows "auth not configured", a server env var is missing — recheck
`SUPABASE_SERVICE_ROLE_KEY`, `WEBAUTHN_ORIGIN`, and `OWNER_EMAIL`.

---

## 6. Post-deploy verification

- Visit `/` — dashboard renders (empty states until you add data).
- Log a cash entry in **Cash Engine** → it persists and the stats update.
- Re-run the Supabase **security advisor** after any schema change; it should
  report zero lints (see `PROGRESS.md`).
- Confirm cross-device login with your second passkey.

---

## 7. Database migrations (future changes)

Migrations live in `supabase/migrations/`. For a new migration:

- Local/CLI: `supabase db push` (requires the project linked + DB password), or
- Apply the SQL through the Supabase dashboard SQL editor / MCP `apply_migration`.

Always run the security + performance advisors afterward.

---

## 8. CI note

The repo ships a CI workflow (`.github/workflows/ci.yml`: typecheck, lint,
build). GitHub Actions must be **enabled** for the repo (Settings → Actions) and
the account must be within its Actions usage/billing limits — until then runs
report `startup_failure` at the account level, unrelated to the code.
