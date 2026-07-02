# Security and Dependency Report

## Security posture

- AI provider keys are not returned by provider list or health endpoints.
- Run detail returns summaries and metadata only, not event payloads, hidden chain-of-thought, raw prompts, or raw model output.
- Memory create/update refuses high-risk secrets using the shared security detector.
- Security status is owner scoped and returns posture flags only.

## Dependency audit

`npm audit --omit=dev` was attempted during validation, but the registry audit endpoint returned `403 Forbidden` in this environment. Re-run the audit from an environment with registry audit access before release.
