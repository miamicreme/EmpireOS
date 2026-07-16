# Empire Voice — Native Architecture

Status: architecture and contract foundation.

Empire Voice is a native EmpireOS capability. It is informed by public voice-assistant patterns, including the separate `Empire-Voice-Module` repository, but no source code from that project is copied into EmpireOS. The reference repository has a non-commercial license, so this implementation must remain clean-room and independently authored.

## Product goal

Let the owner speak naturally to Empire from mobile or desktop, hear an interruptible spoken response, and safely control EmpireOS through the existing Spine, Tool Gateway, Approval Engine, and operation receipts.

```txt
Microphone
→ voice activity detection
→ bounded audio segment
→ transcription
→ confidence / no-speech filtering
→ directed-speech and wake-phrase evaluation
→ Empire run
→ governed Tool Gateway
→ exact approval when required
→ module execution
→ verification and receipt
→ response text
→ interruptible text-to-speech
```

Empire Voice is an input/output layer. It is not a second AI runtime.

## Architectural laws

1. Empire remains the only conversational execution runtime.
2. The Spine remains the only global priority authority.
3. Modules remain the owners of domain truth and operations.
4. Voice never calls repositories or integrations directly.
5. Voice can request only registered tools.
6. Existing tool risk and approval policies apply unchanged.
7. No operation is reported complete without a verified receipt.
8. Audio, transcripts, and voiceprints are private owner data.
9. Wake-word detection grants attention, not permission.
10. External audio and transcripts are untrusted evidence, never authority.

## Components

### 1. Voice Session Controller

Owns the state machine for one live voice interaction.

```txt
idle
listening
speech_detected
capturing
transcribing
evaluating_direction
awaiting_empire
speaking
interrupted
completed
failed
cancelled
```

It stores only safe session metadata by default. Raw audio retention is explicit and separate from live interaction.

### 2. Audio Capture Adapter

Browser-first implementation:

- `MediaDevices.getUserMedia`
- Web Audio API for level data
- `MediaRecorder` for bounded chunks
- push-to-talk as the production baseline
- optional client VAD after baseline reliability is proven

Future native Voice Node:

- local microphone service
- local VAD
- optional local transcription
- secure device authentication to EmpireOS
- no independent memory, priority, or tool authority

### 3. Voice Activity Detection

Responsibilities:

- detect speech start and end
- avoid uploading long silence
- enforce maximum utterance duration
- expose audio-level events for UI
- fail open to push-to-talk controls when VAD is uncertain

VAD is advisory. It must never silently discard the only copy of an utterance without a recoverable client buffer.

### 4. Transcription Gateway

Voice transcription uses the existing capability/provider plane.

Required output:

```ts
{
  text: string;
  language?: string;
  confidence?: number;
  noSpeechProbability?: number;
  durationMs: number;
  provider: string;
  model: string;
}
```

Required filters:

- minimum meaningful duration
- empty-result rejection
- confidence threshold
- no-speech threshold
- repeated phrase suppression
- known hallucination phrase suppression only when evidence supports it
- explicit `capability_unavailable` instead of synthetic transcript text

### 5. Directed-Speech Evaluator

Determines whether Empire was addressed.

Inputs:

- current transcript
- short rolling transcript window
- wake phrase configuration
- whether Empire is in an active follow-up window
- recent TTS output for echo comparison

Outputs:

```txt
directed
not_directed
stop_request
ambiguous
```

This evaluator may decide whether to open an Empire run. It may not choose or execute backend tools.

### 6. Echo and Interruption Controller

Responsibilities:

- hash and retain recent spoken response text temporarily
- compare microphone transcripts against recent Empire speech
- suppress likely self-echo
- treat explicit stop/cancel language as a cancellation signal
- stop TTS immediately when the user interrupts
- cancel or pause the active Empire run only through its official cancellation path

### 7. Empire Bridge

The only allowed voice-to-backend path:

```txt
POST /api/empire/runs
GET  /api/empire/runs/[id]
POST /api/empire/runs/[id]/continue
POST /api/empire/runs/[id]/cancel
```

Voice metadata may be attached as safe client context:

```ts
{
  channel: 'voice';
  sessionId: string;
  utteranceId: string;
  language?: string;
  deviceClass: 'mobile_web' | 'desktop_web' | 'voice_node';
}
```

The bridge sends transcript text or a private artifact reference. It never sends provider secrets or unrestricted tool lists.

### 8. Text-to-Speech Gateway

Capability contract:

- accepts final response text only
- streams audio when supported
- exposes start, progress, completion, and cancellation
- supports a browser fallback
- never speaks hidden reasoning, secrets, raw tool payloads, or approval tokens

TTS must be interruptible. When speech begins, the microphone may be ducked, but explicit interruption detection remains available.

### 9. Voice Evaluation Harness

Required scenario suites:

- wake phrase at beginning, middle, and end
- casual conversation without wake phrase
- active follow-up window
- echo suppression
- stop during TTS
- silence and background audio
- low-confidence transcription
- hallucinated silence transcript
- unsupported transcription provider
- approval-required tool request
- approval replay rejection
- cross-user session access
- duplicate utterance/idempotency protection
- mobile permission denial and recovery

## Tool boundary

Initial voice tools should be read-only or draft-only:

```txt
voice.get_session
voice.get_transcript
voice.create_note_draft
voice.create_followup_drafts
```

Voice does not create separate email, calendar, finance, browser, or system-control tools. It asks Empire to use the existing registered tools for those domains.

## Approval behavior

Spoken confirmation alone is not sufficient for high-risk actions in the first release.

```txt
read-only operation      → automatic
internal draft           → automatic or configurable
reversible internal write→ explicit approval card
external communication   → explicit visual approval
irreversible operation   → strong visual approval
financial/auth operation → blocked or manual-only
```

Later voice approvals may be added only with replay protection, exact-operation binding, liveness, and a visible confirmation channel.

## Data model direction

```txt
voice_sessions
voice_utterances
voice_transcription_runs
voice_speech_runs
voice_device_registrations
voice_evaluation_results
```

All records are owner-scoped. Raw audio is private storage only, short-lived by default, and retained only when explicitly requested.

## Delivery sequence

### Slice 1 — Push-to-talk

- session and utterance schemas
- browser capture
- existing transcription gateway
- POST transcript to Empire
- text response
- browser TTS
- stop button

### Slice 2 — Reliability

- VAD
- confidence/no-speech filters
- duplicate suppression
- echo comparison
- interruption
- progress timeline

### Slice 3 — Conversational mode

- rolling context
- wake phrase
- follow-up window
- directed-speech evaluator
- mobile recovery tests

### Slice 4 — Optional Voice Node

- separately installed local companion
- device enrollment
- local transcription option
- secure streaming/events
- no direct backend authority

## Acceptance gate

Empire Voice is production-ready only when:

```txt
voice request enters through Empire
registered tools are the only execution path
approval policies cannot be bypassed
operation receipts are visible
silence cannot create fake transcripts
TTS can be interrupted
self-echo is suppressed
mobile permission failure recovers cleanly
raw audio remains private
cross-user access tests pass
```
