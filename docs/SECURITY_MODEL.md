# Security Model (Backend V3)

Empire OS is private. Authorization is enforced in the database, not the client.

## Row Level Security

Every user-owned table has RLS enabled with four policies scoped to
`auth.uid()`:

- **select** — `user_id = auth.uid()`
- **insert** — `with check (user_id = auth.uid())`
- **update** — `using` + `with check` on `user_id = auth.uid()`
- **delete** — `user_id = auth.uid()`

Special cases:

- `profiles` is keyed on `id` (the user id) and uses the same pattern on `id`.
- `decision_options` and `decision_votes` are protected through their parent
  `decisions.user_id` via `exists (...)` policies.
- `audit_events` are **insert + select only** — no update/delete policy, making
  the trail immutable.
- `empire_phases` and `modules` are reference tables: readable by any
  authenticated user, not writable from the client.

## User isolation

User-owned data is never visible across users. The client never filters by user;
RLS does. Service functions also scope queries by `user_id` as defense in depth.

## Sensitive data handling

- The `service_role` key is server-only (`getServiceRoleKey`) and never shipped
  to the browser. The browser uses only the anon key.
- `documents.sensitive` flags records that need extra care.
- Secrets are never committed; `.env*` is git-ignored. `.env.example` lists the
  required variable names only.

## AI redaction

Before any context reaches an external AI model:

1. `redactDecisionContext` strips emails, phones, and PII via patterns.
2. `assertNoHighRiskSecrets` throws on SSN / EIN / long account numbers / IBAN.

The decision orchestrator runs both as a gate before any (future) provider call.

## Audit & events

- `audit_events` records an immutable trail (`recordAuditEvent`,
  `getAuditTrail`).
- `system_events` is the automation backbone (`emitSystemEvent`,
  `getUnprocessedEvents`, `markEventProcessed`). Decisions and module changes
  emit events for future automations.
