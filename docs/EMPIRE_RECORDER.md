# Empire Recorder — Architecture Specification

Empire Recorder is the private conversation-intelligence module for EmpireOS.

It is not just an audio uploader. It is a consent-first pipeline:

```txt
Record -> Save private audio -> Owner clicks Process -> Transcribe -> Translate -> Analyze -> Draft actions -> Send to Spine
```

## Product goal

Let the owner record interviews, meetings, voice notes, and conversations from mobile or desktop, then turn the audio into useful intelligence:

- saved source audio
- transcript
- translated transcript when needed
- summary
- key points
- people mentioned
- dates and deadlines
- decisions
- follow-ups
- risks
- unanswered questions
- action drafts for approval
- agent artifact for deeper Empire mentor reasoning

## Module name and blurb

**Module name:** Empire Recorder

**Blurb:** Empire Recorder is a private conversation-intelligence module for recording interviews and meetings, saving source audio, generating transcripts and translations, extracting decisions and follow-ups, and turning conversations into searchable notes and Spine actions.

## Architecture principles

1. Consent first.
2. Owner-only access.
3. Private storage only.
4. No public audio URLs.
5. No transcript/audio content in logs.
6. No AI processing until the owner clicks **Process**.
7. One pipeline into the existing AI provider router and action-draft system.
8. Approval-gated action drafts only.
9. Mobile-first recording UX.
10. Delete must remove audio and metadata intent.

## Current implementation map

```txt
src/app/recorder/page.tsx
src/app/recorder/[id]/page.tsx
src/app/api/recorder/route.ts
src/app/api/recorder/[id]/route.ts
src/app/api/recorder/[id]/process/route.ts
src/app/api/recorder/upload/route.ts
src/app/api/recorder/transcribe/route.ts
src/app/api/recorder/translate/route.ts
src/app/api/recorder/analyze/route.ts
src/modules/recorder/service.ts
src/modules/recorder/analysis.ts
src/modules/recorder/schemas.ts
supabase/migrations/0022_recorder_module.sql
```

## User flow

```txt
/recorder
  -> consent acknowledgement
  -> record / pause / resume / stop
  -> save title
  -> upload audio to private storage
  -> owner clicks Process
  -> processing timeline
  -> transcription
  -> translation if needed
  -> analysis summary
  -> action drafts

/recorder/[id]
  -> listen with short-lived signed URL
  -> click Process if not processed
  -> read transcript
  -> toggle translation
  -> review summary cards
  -> approve/reject action drafts
  -> delete recording
```

## Pages

- `/recorder` — recorder workbench and saved recordings list.
- `/recorder/[id]` — recording detail, playback, transcript, translation, summary, and action drafts.

## Database

The current implementation uses `recordings` from `supabase/migrations/0022_recorder_module.sql`.

Core fields:

```txt
id
user_id
title
status
audio_storage_path
mime_type
duration_seconds
language
transcript
translated_transcript
summary
metadata
error
consent_confirmed
created_at
updated_at
```

Status values:

```txt
uploaded
transcribing
transcribed
translating
translated
analyzing
ready
failed
```

Recommended indexes:

```sql
create index if not exists recordings_user_created_idx
  on public.recordings (user_id, created_at desc);

create index if not exists recordings_user_status_idx
  on public.recordings (user_id, status);
```

## RLS

All rows must be restricted to the authenticated owner:

```sql
alter table public.recordings enable row level security;

create policy "recordings_select_own" on public.recordings
  for select using (auth.uid() = user_id);

create policy "recordings_insert_own" on public.recordings
  for insert with check (auth.uid() = user_id);

create policy "recordings_update_own" on public.recordings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recordings_delete_own" on public.recordings
  for delete using (auth.uid() = user_id);
```

## Storage

The current implementation uses the private Supabase Storage bucket:

```txt
recordings
```

Path format:

```txt
{userId}/{uuid}.{ext}
```

Rules:

- private bucket only
- no public URLs
- signed URL only for short-lived playback
- server-side processing downloads from storage through owner-authenticated routes
- delete removes the storage object before deleting metadata

## API routes

Current routes:

```txt
GET    /api/recorder
GET    /api/recorder/[id]
PATCH  /api/recorder/[id]
DELETE /api/recorder/[id]
POST   /api/recorder/upload
POST   /api/recorder/[id]/process
POST   /api/recorder/transcribe
POST   /api/recorder/translate
POST   /api/recorder/analyze
```

Preferred UX path is `/api/recorder/[id]/process`, which runs the full pipeline only after explicit owner action.

Legacy/direct step endpoints remain useful for retries and debugging, but they should not be called automatically after upload.

Every route must require owner auth and validate request bodies.

## Processing pipeline

Processing is explicit. The owner records and saves first, then clicks Process.

```txt
uploaded -> transcribing -> transcribed -> translating -> translated -> analyzing -> ready
```

Failure state:

```txt
failed
```

The UI should never imply a recording was analyzed if it only uploaded.

## AI integration

Text translation and analysis use the existing provider router:

1. Requesty if configured.
2. Direct provider keys as fallback.
3. LM Studio local/private fallback for text tasks when reachable.
4. Free OpenAI-compatible providers as fallback.
5. Stub/error-safe fallback.

Speech-to-text is separate from chat inference. Current transcription uses the audio transcription backend in `src/spine/ai/audio.ts`.

Do not expose provider keys or local provider URLs to the client.

## Empire integration

Empire Recorder remains a module. Empire can invoke recorder capabilities only through registered tools and owner-scoped module services.

```txt
Recording artifact
  -> Empire reads trusted transcript evidence
  -> Empire proposes follow-ups
  -> owner approves exact actions
  -> Spine receives verified actions
```

Empire must never claim transcription, analysis, or action creation without a verified backend result or receipt.

## UX requirements

Mobile-first recorder UI:

- large centered Record button
- pause/resume/stop controls
- timer
- audio level meter or waveform
- upload progress
- explicit Process button after save
- saved recordings list
- transcript panel
- translation toggle
- summary cards
- action draft approval
- delete recording

Consent copy:

```txt
Only record conversations when legally allowed and with proper consent.
```

Require acknowledgement before recording starts and save the consent state.

## Limits

Current schema defaults:

```txt
max duration: 24 hours
max file size: 60MB
supported MIME: audio/webm, audio/ogg, audio/mp4, audio/m4a, audio/x-m4a, audio/mpeg, audio/mp3, audio/wav, audio/x-wav
```

Product recommendation for normal interviews:

```txt
soft max duration: 2 hours
soft max file size: 250MB when storage/processing is upgraded
```

## Tests

Add/maintain tests for:

- owner-only recorder routes
- consent required before recording
- private storage path only
- no public URL exposure
- MIME validation
- file size validation
- process route requires owner
- upload does not auto-send audio to AI
- transcript/audio not logged
- delete removes metadata and storage delete intent
- UI renders record, pause, resume, stop, upload, process, and delete states

## Manual test plan

1. Open `/recorder` on iPhone.
2. Accept consent warning.
3. Record 30 seconds.
4. Pause and resume.
5. Stop recording.
6. Save title.
7. Confirm upload completes.
8. Confirm no transcription starts automatically.
9. Click Process.
10. Confirm transcript appears.
11. Translate if needed.
12. Review summary and extracted follow-ups.
13. Approve/reject action drafts.
14. Delete recording.
15. Confirm audio is inaccessible after delete.
