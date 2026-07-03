# Security and Dependency Report

## Security posture

- AI provider keys are not returned by provider list or health endpoints.
- Run detail returns summaries and metadata only, not event payloads, hidden chain-of-thought, raw prompts, or raw model output.
- Memory create/update refuses high-risk secrets using the shared security detector.
- Security status is owner scoped and returns posture flags only.

## Dependency audit

`npm audit --omit=dev` was attempted during validation, but the registry audit endpoint returned `403 Forbidden` in this environment. Re-run the audit from an environment with registry audit access before release.

## 2026-07-03 audit attempt during V7.1 input polish

Command: `npm audit --omit=dev`

Result: environment-blocked, not clean. npm returned `403 Forbidden - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` and `npm error audit endpoint returned an error`. Re-run audit when the registry endpoint is accessible; do not mark dependency audit clean until it completes.
