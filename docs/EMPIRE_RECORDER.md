# Empire Recorder — Architecture Specification

Empire Recorder is the private conversation-intelligence module for EmpireOS.

It is not just an audio uploader. It is a full pipeline:

```txt
Record -> Save audio -> Transcribe -> Translate -> Analyze -> Create artifact -> Draft actions -> Send to Spine
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
- agent artifact for deeper Jarvis-grade mentor reasoning

## Module name and blurb

**Module name:** Empire Recorder

**Blurb:** Empire Recorder is a private conversation-intelligence module for recording interviews and meetings, saving source audio, generating transcripts and translations, extracting decisions and follow-ups, and turning conversations into searchable notes and Spine actions.

## Architecture principles

1. Consent first.
2. Owner-only access.
3. Private storage only.
4. No public audio URLs.
5. No transcript/audio content in logs.
6. No AI processing until the owner clicks Process.
7. One pipeline into the existing AI orchestrator and artifact system.
8. Approval-gated action drafts only.
9. Mobile-first recording UX.
10. Delete must remove audio and metadata intent.

## User flow

```txt
/recorder
  -> consent acknowledgement
  -> record / pause / resume / stop
  -> save title
  -> upload audio to private storage
  -> processing timeline
  -> transcription
  -> translation if needed
  -> analysis summary
  -> action drafts
  -> send to agent with inputArtifactIds

/recorder/[id]
  -> listen if allowed
  -> read transcript
  -> toggle translation
  -> review summary cards
  -> approve actions
  -> send to agent
  -> delete recording
```

## Pages

- `/recorder` — recorder workbench and saved recordings list.
- `/recorder/[id]` — recording detail, transcript, translation, summary, action drafts, and send-to-agent.

## Database

Create a migration for `recorder_sessions`:

```sql
create table if not exists public.recorder_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'draft',
  audio_storage_path text,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds integer,
  source_language text,
  translated_language text default 'en',
  transcript text,
  translated_transcript text,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  dates jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  agent_artifact_id uuid null,
  consent_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended indexes:

```sql
create index if not exists recorder_sessions_user_created_idx
  on public.recorder_sessions (user_id, created_at desc);

create index if not exists recorder_sessions_user_status_idx
  on public.recorder_sessions (user_id, status);
```

## RLS

Enable RLS and restrict all rows to the authenticated owner:

```sql
alter table public.recorder_sessions enable row level security;

create policy "recorder owner select" on public.recorder_sessions
  for select using (auth.uid() = user_id);

create policy "recorder owner insert" on public.recorder_sessions
  for insert with check (auth.uid() = user_id);

create policy "recorder owner update" on public.recorder_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recorder owner delete" on public.recorder_sessions
  for delete using (auth.uid() = user_id);
```

## Storage

Use a private Supabase Storage bucket:

```txt
recorder-audio
```

Path format:

```txt
owner/{userId}/recordings/{recordingId}/source.webm
```

Rules:

- private bucket only
- no public URLs
- signed URL only when a server-side route intentionally needs temporary playback/download
- delete should remove the storage object and DB metadata intent

## API routes

```txt
GET    /api/recorder
POST   /api/recorder
GET    /api/recorder/[id]
PATCH  /api/recorder/[id]
DELETE /api/recorder/[id]
POST   /api/recorder/[id]/upload
POST   /api/recorder/[id]/process
POST   /api/recorder/[id]/transcribe
POST   /api/recorder/[id]/translate
POST   /api/recorder/[id]/analyze
POST   /api/recorder/[id]/send-to-agent
```

Every route must require owner auth and validate request bodies with Zod.

## Processing pipeline

Processing should be explicit. The owner records and saves first, then clicks Process.

```txt
saved -> uploaded -> transcribing -> translating -> analyzing -> ready
```

Failure states:

```txt
upload_failed
transcription_failed
translation_failed
analysis_failed
```

## AI integration

Use the existing provider routing:

1. Requesty if configured.
2. Direct provider keys as fallback.
3. Safe error if no transcription-capable provider is configured.

Do not expose provider keys to the client.

## Agent artifact

After analysis, create an `agent_artifact`:

```txt
artifactType: voice_transcript_analysis
```

Content should include:

- recording id
- transcript summary
- translated transcript summary
- key points
- people
- dates
- decisions
- follow-ups
- risks
- questions
- source refs

Then `/api/recorder/[id]/send-to-agent` should call the normal agent path by passing the artifact id through `inputArtifactIds` to:

```txt
POST /api/ai/agent/run
```

## UX requirements

Mobile-first recorder UI:

- large centered Record button
- pause/resume/stop controls
- timer
- audio level meter or waveform
- upload progress
- processing timeline
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

Require acknowledgement before recording starts and save `consent_acknowledged_at`.

## Limits

Recommended defaults:

```txt
max duration: 2 hours
max file size: 250MB
supported MIME: audio/webm, audio/mp4, audio/mpeg, audio/wav, audio/x-m4a
```

## Tests

Add tests for:

- owner-only recorder routes
- consent required before recording
- private storage path only
- no public URL exposure
- MIME validation
- file size validation
- process route requires owner
- transcript/audio not logged
- delete removes metadata and storage delete intent
- send-to-agent passes `inputArtifactIds`
- UI renders record, pause, resume, stop, upload, process, and delete states

## Manual test plan

1. Open `/recorder` on iPhone.
2. Accept consent warning.
3. Record 30 seconds.
4. Pause and resume.
5. Stop recording.
6. Save title.
7. Confirm upload completes.
8. Click Process.
9. Confirm transcript appears.
10. Translate if needed.
11. Review summary and extracted follow-ups.
12. Approve action drafts.
13. Send to agent.
14. Delete recording.
15. Confirm audio is inaccessible after delete.
