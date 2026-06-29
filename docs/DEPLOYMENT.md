# Empire OS — Deployment Guide

How to take Empire OS live and register your first passkey. The recommended
host is **Vercel** (first-class Next.js App Router support); any Node host works.

The Supabase project (`EmpireOS`) is already created and migrated — see
[`PROGRESS.md`](./PROGRESS.md). This guide covers wiring the app to it and going
live.

---

## 1. Prerequisites

- The `EmpireOS` Supabase project (already provisioned, 25 tables, RLS on all).
- A host account (Vercel recommended).
- Your production domain, e.g. `https://empire.yourdomain.com`.

---

## 2. Environment variables

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

## 3. Deploy to Vercel

1. Push `main` to GitHub (already done).
2. In Vercel: **New Project → Import** the `miamicreme/EmpireOS` repo.
3. Framework preset: **Next.js** (auto-detected). Build command `next build`,
   output handled automatically.
4. Add all environment variables from section 2 (Production scope).
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

## 4. First login (claim the owner account)

1. Open your deployed site → you'll be redirected to `/login`.
2. Tap **Create passkey** → approve with Face ID / Touch ID / Windows Hello.
   This first passkey claims the single owner account.
3. You're in. Go to **Passkeys** (sidebar) and **Add passkey** on a second
   device (e.g. your phone) so you have a recovery key — removing your only
   passkey is blocked by design.

If `/login` shows "auth not configured", a server env var is missing — recheck
`SUPABASE_SERVICE_ROLE_KEY`, `WEBAUTHN_ORIGIN`, and `OWNER_EMAIL`.

---

## 5. Post-deploy verification

- Visit `/` — dashboard renders (empty states until you add data).
- Log a cash entry in **Cash Engine** → it persists and the stats update.
- Re-run the Supabase **security advisor** after any schema change; it should
  report zero lints (see `PROGRESS.md`).
- Confirm cross-device login with your second passkey.

---

## 6. Database migrations (future changes)

Migrations live in `supabase/migrations/`. For a new migration:

- Local/CLI: `supabase db push` (requires the project linked + DB password), or
- Apply the SQL through the Supabase dashboard SQL editor / MCP `apply_migration`.

Always run the security + performance advisors afterward.

---

## 7. CI note

The repo ships a CI workflow (`.github/workflows/ci.yml`: typecheck, lint,
build). GitHub Actions must be **enabled** for the repo (Settings → Actions) and
the account must be within its Actions usage/billing limits — until then runs
report `startup_failure` at the account level, unrelated to the code.
