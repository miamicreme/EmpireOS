# Supabase — Empire OS Backend

This folder holds the database layer for the Empire OS spine.

## Contents

- `migrations/0001_spine_backend_v3.sql` — full spine + module schema, indexes,
  `updated_at` triggers, and Row Level Security policies.
- `seed.sql` — reference data (empire phases, modules). No private data.

## Local development

```bash
# start the local Supabase stack (Docker required)
supabase start

# apply migrations to the local database
supabase db reset        # drops, re-runs migrations, then runs seed.sql

# OR push migrations to a linked remote project
supabase db push
```

## Applying to a remote project

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Then run the seed (reference data only):

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Security notes

- Every user-owned table has RLS enabled and is isolated by `auth.uid()`.
- `empire_phases` and `modules` are reference tables: readable by any
  authenticated user, not writable from the client.
- `decision_options` and `decision_votes` are protected via their parent
  `decisions.user_id`.
- `audit_events` are insert + read only (immutable: no update/delete policy).
- Never put real private records (cash, credit, tax, PII) in `seed.sql`.
