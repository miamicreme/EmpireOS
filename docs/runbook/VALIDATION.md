# Validation

How correctness is enforced across Empire OS.

## Layers of Validation

1. **Schema validation (Zod)** — every input crossing a boundary (API route,
   server action, module handler) is parsed with a Zod schema. Invalid input is
   rejected before it reaches business logic.
2. **Database constraints** — PostgreSQL constraints (types, foreign keys, checks)
   enforce integrity at rest.
3. **Row Level Security (RLS)** — access is enforced per-row in the database, not
   only in application code.
4. **Type safety** — TypeScript end to end; database types generated from Supabase.

## Pre-merge Checklist

- [ ] Types compile (`tsc` / `next build`)
- [ ] Lint passes
- [ ] Zod schemas cover all new inputs
- [ ] RLS policies exist for any new tables
- [ ] No secrets committed

## Deployment Validation

- Run the production build before deploying.
- Verify RLS policies in the target Supabase project.
- Smoke-test critical flows after deploy.

> Expand with concrete test commands as the test suite is established.
