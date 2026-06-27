# Backend Runbook (V3)

How to install, migrate, seed, and verify the Empire OS backend spine.

## 1. Install dependencies

```bash
npm install
```

## 2. Environment

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY (AI keys optional)
```

## 3. Run Supabase locally

```bash
supabase start          # requires Docker
```

## 4. Apply migrations

```bash
# local: reset re-runs all migrations then runs seed.sql
supabase db reset

# remote (linked project):
supabase link --project-ref <ref>
supabase db push
```

## 5. Seed reference data

`supabase db reset` runs `supabase/seed.sql` automatically (empire phases +
modules, no private data). For a remote DB:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

## 6. Typecheck

```bash
npm run typecheck
```

## 7. Run the app (backend only)

```bash
npm run dev
# verify: GET http://localhost:3000/api/health
```

## 8. Test the services / routes

All write routes require an authenticated Supabase session (RLS). With a valid
session cookie:

- `GET  /api/health` — service health (no auth)
- `GET  /api/modules` — module registry metadata (no user data)
- `GET  /api/actions` — ranked actions
- `POST /api/actions` — create an action (Zod-validated)
- `GET  /api/metrics` — today's metrics
- `POST /api/metrics` — record a metric
- `GET  /api/decisions` — list decisions
- `POST /api/decisions` — create a decision
- `POST /api/sync` — sync modules, return command dashboard

## Notes

- No UI is built yet (placeholder page only).
- Rank and Empire Score are computed in the service layer.
- AI advisors return stub votes until a provider key is set.
