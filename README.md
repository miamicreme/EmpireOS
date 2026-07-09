# Empire OS

Private execution operating system for KJB Empire planning.

## Architecture

- **Spine** — owns priority. The central nervous system that decides what matters now.
- **Modules** — own detail. Domain-specific units of work and state.
- **Universal Input** — normalizes documents, spreadsheets, screenshots, camera frames, video frames, and audio into agent artifacts.
- **Career Command** — upgraded job-hunt module with fit scoring, drafter-reviewer application workflow, interview prep, offer decision support, and outcome calibration. See [`docs/JOB_HUNT_INTELLIGENCE.md`](./docs/JOB_HUNT_INTELLIGENCE.md).
- **Empire Recorder** — planned private conversation-intelligence module for recording interviews/meetings, saving audio, transcribing, translating, analyzing, and drafting follow-ups. See [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md).
- **AI Decision Engine** — a multi-advisor engine that turns information into decisions.
- **Jarvis-grade Mentor Agent** — an AI execution layer on top of the Spine that reads context, diagnoses the real issue, maps leverage, spots blind spots, generates briefs, and drafts actions for approval.

Flow: **Inputs create artifacts → Artifacts feed decisions → Decisions create actions → Actions move phases → Phases build the empire.**

## Tech Stack

- Next.js (App Router)
- TypeScript
- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Zod
- Tailwind

## Current Build Status

- ✅ Documentation & repo organization
- ✅ Backend spine (actions, decisions, metrics, reviews, events, audit)
- ✅ Module system (6 modules on a uniform `ModuleContract`)
- ✅ AI decision engine (multi-advisor, redaction-gated)
- ✅ Module CRUD + review API routes (auth + RLS + Zod on every write)
- ✅ Dashboard UI + command center
- ✅ Individual module UIs (all 6 wired to their APIs)
- ✅ AI Chief of Staff / Jarvis-grade mentor surface
- ✅ Universal input foundation
- ✅ Passkey multi-device pairing plan and implementation path
- ✅ Career Command intelligence helper for fit scoring, pipeline risks, and interview/application next moves
- 📌 Planned: Empire Recorder conversation-intelligence module
- ⏭️ Validation, deployment, and live Supabase wiring next

See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the detailed status and next steps.

## Build Order

1. ✅ Repo / docs organization
2. ✅ Backend spine
3. ✅ Module system
4. ✅ Decision engine
5. ✅ Dashboard UI
6. ✅ Individual module UIs
7. ✅ Jarvis-grade AI mentor surface
8. ✅ Career Command intelligence extraction
9. 📌 Empire Recorder architecture and implementation
10. ⏭️ Validation and deployment

## Career Command Pipeline

```txt
Paste/upload job
  -> Extract role/company/pay/requirements
  -> Score fit
  -> Identify strengths/gaps
  -> Recommend apply/skip/call first
  -> Draft resume bullets
  -> Draft cover letter
  -> Run reviewer critique
  -> Create interview prep
  -> Track outcome
  -> Feed calibration back to the Spine
```

## Empire Recorder Pipeline

```txt
Record interview
  -> Save private audio
  -> Transcribe
  -> Translate
  -> Analyze conversation
  -> Create voice_transcript_analysis artifact
  -> Send to Jarvis-grade mentor agent
  -> Draft approval-gated Spine actions
```

Empire Recorder must be consent-first, owner-only, private-storage-only, and integrated into the existing artifact and agent runtime instead of becoming a separate AI subsystem.

## Important Docs

- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy + first passkey login
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) — status & next steps
- [`docs/JOB_HUNT_INTELLIGENCE.md`](./docs/JOB_HUNT_INTELLIGENCE.md) — Career Command / job-hunt intelligence extraction
- [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md) — audio recorder / conversation intelligence architecture
- [`docs/MENTOR_GENIUS_PROMPT.md`](./docs/MENTOR_GENIUS_PROMPT.md) — mentor behavior standard
- [`CLAUDE_BUILD_INSTRUCTIONS.md`](./CLAUDE_BUILD_INSTRUCTIONS.md)
- [`MASTER_GUIDE.md`](./MASTER_GUIDE.md)
- [`docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md`](./docs/prompts/Backend_Spine_Prompt_V3_High_Tech.md)
- [`docs/prompts/Module_System_Prompt_V3_High_Tech.md`](./docs/prompts/Module_System_Prompt_V3_High_Tech.md)
- [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
- [`docs/runbook/BRANCHING.md`](./docs/runbook/BRANCHING.md)

## Documentation Map

```
.
├── README.md
├── README_BACKEND.md
├── CLAUDE_BUILD_INSTRUCTIONS.md
├── MASTER_GUIDE.md
└── docs/
    ├── SECURITY.md
    ├── JOB_HUNT_INTELLIGENCE.md
    ├── EMPIRE_RECORDER.md
    ├── MENTOR_GENIUS_PROMPT.md
    ├── prompts/
    │   ├── Backend_Spine_Prompt_V3_High_Tech.md
    │   └── Module_System_Prompt_V3_High_Tech.md
    ├── architecture/
    │   ├── ARCHITECTURE.md
    │   ├── SPINE_DESIGN.md
    │   ├── MODULE_DESIGN.md
    │   └── DECISION_ENGINE.md
    └── runbook/
        ├── BRANCHING.md
        ├── RUNBOOK.md
        └── VALIDATION.md
```
