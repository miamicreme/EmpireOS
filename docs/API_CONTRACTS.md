# EmpireOS API Contracts

## Canonical AI agent command path

- `POST /api/ai/agent/run` is the only AI command execution path.
- Agent runtime data is stored in compact `agent_*` tables.
- Hidden chain-of-thought, raw prompts, API keys, and high-risk secrets must not be returned to clients.

## Action drafts

- `GET /api/ai/agent/action-drafts` lists pending action drafts.
- `POST /api/ai/agent/action-drafts/[id]/approve` approves or rejects a draft.
- Approval accepts edit-before-approve fields: `title`, `description`, `category`, and `priority`.
- The obsolete `PATCH /api/ai/agent/action-drafts/[id]` route has been removed.

## Agent runs

- `GET /api/ai/agent/runs?threadId=...` returns thread run history.
- `GET /api/ai/agent/runs/[id]` returns a safe run detail view: run summary, event summaries, artifact summaries, action drafts, and provider-run metadata only.
- Run detail responses intentionally exclude event payloads, raw prompts, raw model outputs, hidden chain-of-thought, and secrets.

## Memory

- `GET /api/ai/agent/memory?status=active` lists owner-scoped durable memory.
- `POST /api/ai/agent/memory` saves durable memory after high-risk secret checks.
- `PATCH /api/ai/agent/memory/[id]` updates durable memory after high-risk secret checks.
- `DELETE /api/ai/agent/memory/[id]` soft-deletes memory by marking it `deleted`.
- `POST /api/ai/agent/memory/[id]/approve` marks memory `active` by default or `archived` when `{ "action": "reject" }` is sent.

## Provider health

- `GET /api/ai/providers/health` returns a secret-free provider readiness summary.
- Provider health may expose provider/model identifiers and boolean readiness flags; it must not expose API keys or encrypted key material.
- The response includes a `requesty` object with configured/enabled flags, safe route model IDs, route purpose, latency/failure fields when available, and an estimated-cost availability flag.

## Security status

- `GET /api/settings/security/status` returns owner-scoped security posture: authentication, passkey count, recovery enabled flag, and a hard `secretValuesReturned: false` marker.

## Passkey enrollment

- `POST /api/auth/passkeys/enrollment` creates a short-lived one-time enrollment token for the signed-in owner and returns an enrollment URL.
- `GET /api/auth/passkeys/enrollment/[token]/status` is public and returns only safe enrollment state: `valid`, `expired`, `used`, `labelHint`, and `expiresAt`.
- `POST /api/auth/passkeys/enrollment/[token]/register/options` creates WebAuthn registration options for the token-bound owner without requiring the new device to already be signed in.
- `POST /api/auth/passkeys/enrollment/[token]/register/verify` verifies the response, marks the token used, inserts the new passkey credential for the same owner, and establishes the owner session on the new device.
- The enrollment token raw value is returned once to the signed-in device and is never stored server-side; only a hash is persisted.
- Emergency recovery remains a separate, destructive break-glass path and is not the normal new-device setup flow.

## Owner UI surfaces

- `/ai/input` is the interactive universal input workbench. It uploads file metadata, analyzes normalized input into a safe artifact, and can hand that artifact to `POST /api/ai/agent/run` through `inputArtifactIds`.
- `/ai/camera` is the explicit browser camera workbench. It starts only on user click, captures on-demand snapshots, and can sample a bounded 10-frame/10-second window for safe analysis.
- `/ai/runs/[id]` is the safe run detail view over `GET /api/ai/agent/runs/[id]`.
- `/ai/memory` is the durable memory workbench over the compact memory endpoints.
- `/ai/providers` is the provider health/status workbench over the secret-free provider endpoints.
- `/settings/security` is the owner security workbench over `GET /api/settings/security/status`.

## Universal input and camera contracts

- `POST /api/ai/input/upload` validates owner-only upload metadata for PDF, DOCX, TXT/MD, CSV/XLSX, PNG/JPEG/WebP inputs. It returns `publicUrl: null` so callers do not depend on public file exposure.
- `POST /api/ai/input/analyze` accepts normalized document, spreadsheet, image, screenshot, camera snapshot, sampled video-frame, or voice transcript payloads and writes standardized compact agent artifacts.
- `POST /api/ai/input/camera-frame` forces `inputType: "camera_snapshot"` and analyzes only an explicitly submitted snapshot.
- `POST /api/ai/input/video-frames/analyze` forces `inputType: "video_frames"` and is guarded by the universal input service's 10-frame maximum.
- Universal input remains subordinate to the single reasoning command path: callers should pass returned artifact IDs to `POST /api/ai/agent/run` through `inputArtifactIds` for deeper analysis or action drafting.

## Empire Recorder

- `POST /api/recorder/upload` — multipart/form-data (`audio` file, `title`, `durationSeconds`, `consentConfirmed`). Uploads to the private `recordings` Storage bucket and inserts the row. Requires `consentConfirmed: "true"`.
- `POST /api/recorder/transcribe` — `{ id }`. Transcribes the stored audio (OpenAI Whisper; deterministic stub when `OPENAI_API_KEY` is unset) and stores `transcript` + detected `language`.
- `POST /api/recorder/translate` — `{ id, force? }`. Translates the transcript to English through the standard text-provider chain; skipped (transcript copied through) when the detected language already looks like English and `force` isn't set.
- `POST /api/recorder/analyze` — `{ id }`. Extracts a summary, key points, decisions, follow-ups, questions, names, dates, and risks, and drafts candidate actions into `ai_action_drafts` (module-tagged `recorder`) via the same approval-gated path as every other AI feature.
- `GET /api/recorder` — lists the owner's recordings.
- `GET /api/recorder/[id]` — recording detail, including a 5-minute signed audio URL (never a public URL).
- `PATCH /api/recorder/[id]` — rename only; pipeline fields (`transcript`, `status`, …) are server-owned.
- `DELETE /api/recorder/[id]` — removes the DB row and the stored audio object together.
