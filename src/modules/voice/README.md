# Empire Voice Module

Empire Voice is the native voice interface for EmpireOS.

It does not own reasoning, memory, priority, or backend execution. It captures speech, validates transcription quality, determines whether Empire was addressed, forwards the request into the authoritative Empire runtime, and renders an interruptible spoken response.

## Boundary

```txt
Voice owns
- capture state
- VAD signals
- utterance metadata
- transcription quality gates
- wake phrase / directed-speech evaluation
- echo comparison
- TTS playback and interruption

Empire owns
- intent
- planning
- tool selection
- approvals
- execution
- verification
- receipts

Spine owns
- global priority
- cross-module action ranking
- phase progression
```

## Clean-room rule

The separate `Empire-Voice-Module` repository is used only as a product and architecture reference. Its non-commercial source code must not be copied into EmpireOS without a separate commercial license.

## Initial implementation order

1. Push-to-talk browser capture.
2. Transcription through the existing capability gateway.
3. Post trusted transcript text to `/api/empire/runs`.
4. Render response text and browser TTS.
5. Add stop/interruption.
6. Add VAD, confidence/no-speech filtering, echo suppression, and rolling context.
7. Add optional enrolled desktop Voice Node.

## Tool policy

Voice-specific tools are limited to voice records and draft creation. Requests to email, calendar, finance, browser, projects, Recorder, or any other domain must use that module's existing registered tools and approval policy.
