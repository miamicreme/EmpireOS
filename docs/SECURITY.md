# Security

Empire OS is a **private** execution operating system. Security is foundational.

## Principles

- **Least privilege** — every actor and key gets the minimum access required.
- **Defense in depth** — application checks plus database-enforced Row Level Security.
- **Secrets never in the repo** — use environment variables / a secrets manager.

## Database Security

- **Row Level Security (RLS)** is enabled on all tables. Access is enforced in the
  database, so a bug in application code cannot bypass authorization.
- The `service_role` key is used only server-side and never exposed to the client.
- The public/anon key is the only key shipped to the browser.

## Application Security

- All inputs validated with Zod at every boundary.
- Server actions and API routes verify the authenticated user before acting.
- No trust in client-supplied identifiers; ownership is checked via RLS.

## Secrets Management

- `.env.local` and any secret files are git-ignored.
- Rotate keys if they are ever exposed.
- Do not log secrets or full tokens.

## Reporting

This is a private project. Report security concerns directly to the project owner.
