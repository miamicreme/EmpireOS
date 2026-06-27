# Runbook

Operational guide for developing and running Empire OS.

## Prerequisites

- Node.js (LTS) and a package manager (npm/pnpm)
- A Supabase project (PostgreSQL + Auth)
- Environment variables for Supabase URL and keys (never commit secrets)

## Local Development (once the app exists)

```bash
# install dependencies
npm install

# run the Next.js dev server (App Router)
npm run dev
```

## Environment

Configure (in `.env.local`, not committed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

## Database

- Schema changes are applied as Supabase migrations.
- All tables use Row Level Security (RLS).
- Validate all inputs with Zod before they reach the database.

## Current State

The repository currently contains documentation only. The backend spine is the
next thing to build (see [`BRANCHING.md`](./BRANCHING.md) and
[`../prompts/Backend_Spine_Prompt_V3_High_Tech.md`](../prompts/Backend_Spine_Prompt_V3_High_Tech.md)).
