# KJB Personal Integration

Empire owns intelligence, approvals, memory, priorities, and execution history. KJB Personal is a public outlet that renders and distributes approved content.

## Required Empire environment variables

- `KJB_INGEST_TOKEN` — long random shared secret used only by KJB Personal.
- `OWNER_USER_ID` — Supabase UUID of the Empire owner.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key used by the authenticated ingestion route.

## Endpoint

`POST /api/integrations/kjb/events`

The endpoint accepts versioned `kjb-personal` events, validates the bearer token, persists them to `content_runs`, and exposes the results to the Content Intelligence Spine module.

## Safety boundary

KJB publishing remains fail-open if Empire telemetry is unavailable. Empire never receives social credentials, subscriber addresses, article bodies, or secret values through this contract.

## Deployment order

1. Apply the `content_runs` migration.
2. Deploy Empire with the three required environment variables.
3. Configure KJB Personal with `EMPIRE_API_URL` and the matching `EMPIRE_INGEST_TOKEN`.
4. Publish one controlled test item.
5. Confirm the event appears in Empire before increasing automation volume.
