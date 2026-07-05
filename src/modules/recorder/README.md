# Empire Recorder Module

Private audio intelligence: record an interview, meeting, or conversation, save
the source file, transcribe it, translate it if needed, summarize it, and turn
it into searchable notes and action drafts routed to the Spine's approval
queue. Owner-only end to end — no recording is ever reachable by a public URL.

**Only record conversations when legally allowed and with proper consent.**
The recorder UI requires an explicit consent confirmation before the first
recording can be saved (see `schemas.ts#uploadRecordingSchema`).

## DB Table
- `recordings` — one row per recording: audio storage path, mime type,
  duration, detected language, transcript, translated transcript, summary,
  pipeline status, and a `metadata` jsonb bag (migration `0022_recorder_module`).

## Storage
- Private Supabase Storage bucket `recordings`. Objects are keyed
  `<user_id>/<uuid>.<ext>` so RLS can verify ownership from the path alone
  (see the `storage.objects` policies in the same migration). Audio is only
  ever served through a 5-minute signed URL minted server-side for the
  authenticated owner — never a public URL.

## Pipeline
`uploaded → transcribing → translating (if needed) → analyzing → ready`
(or `failed` at any stage, with a human-readable `error`).

1. **Upload** (`service.ts#createRecording`) — validate consent + mime type,
   upload bytes to Storage, insert the row.
2. **Transcribe** (`@/spine/ai/audio.ts#transcribeAudio`) — OpenAI Whisper
   (`whisper-1`); detects `language` for free via `verbose_json`. Falls back
   to a stub transcript when `OPENAI_API_KEY` isn't configured.
3. **Translate** (`analysis.ts#translateTranscript`) — only when the detected
   language isn't English; runs through the standard text-provider chain
   (`runStructured`), so any configured provider (Anthropic/OpenAI/Requesty/…)
   can do it.
4. **Analyze** (`analysis.ts#analyzeRecording`) — structured extraction of a
   summary, key points, decisions, follow-ups, questions, names, dates, and
   risks, plus candidate actions drafted into `ai_action_drafts` via
   `createDraftsFromSuggestions` (module-tagged `recorder`). Drafts require
   explicit approval before becoming real `global_actions` — the AI never
   writes to the Spine directly.

## Key Metrics
- `recordings_total`, `recordings_ready`, `recordings_pending`, `recordings_failed`

## Health Logic
- Red: any recording in `failed`
- Yellow: any recording still `transcribing` / `translating` / `analyzing`
- Green: everything processed cleanly (including zero recordings)

## Decision Context
Recent recording count, failed count, and the latest ready summaries — feeds
the AI Chief of Staff without re-sending raw transcripts.

## Events
`recorder.recording.uploaded`, `.transcribed`, `.translated`, `.analyzed`,
`.failed`, `.deleted`, plus `module.synced`.

## How to Extend
Follow `src/modules/_template`: this module already implements the full
`ModuleContract`. Additional pipeline stages should stay in `analysis.ts`
(AI-facing) vs. `service.ts` (CRUD + storage) to keep the same separation as
`spine/ai/intake.service.ts`.
