# Empire OS

Private execution operating system for KJB Empire planning.

## Architecture

- **Spine** — owns priority. The central nervous system that decides what matters now.
- **Modules** — own detail. Domain-specific units of work and state.
- **Universal Input** — normalizes documents, spreadsheets, screenshots, camera frames, video frames, and audio into agent artifacts.
- **Career Command** — upgraded job-hunt module with fit scoring, drafter-reviewer application workflow, interview prep, offer decision support, and outcome calibration. See [`docs/JOB_HUNT_INTELLIGENCE.md`](./docs/JOB_HUNT_INTELLIGENCE.md).
- **Empire Recorder** — private conversation-intelligence module for recording interviews/meetings, saving audio, transcribing, translating, analyzing, and drafting follow-ups. See [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md).
- **AI Decision Engine** — a multi-advisor engine that turns information into decisions.
- **Provider Router** — routes AI work through Requesty, direct cloud keys, LM Studio local/private fallback, free OpenAI-compatible fallbacks, and stub mode. See [`docs/INFERENCE_SERVERS.md`](./docs/INFERENCE_SERVERS.md).
- **Empire Intelligence** — the real conversational execution layer above the Spine. It reads trusted context, diagnoses the real issue, plans governed work, requests approval, executes registered tools, verifies outcomes, and returns receipts.

Flow: **Inputs create artifacts → Artifacts feed decisions → Decisions create actions → Actions move phases → Phases build the empire.**

Core law: **The Spine owns priority. Modules own detail. Decisions create actions. Actions move phases. Phases build the empire.** See [`docs/SPINE_MODULE_GUARDRAILS.md`](./docs/SPINE_MODULE_GUARDRAILS.md).

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
- ✅ Module system (`ModuleContract` + `src/spine/module-registry.ts`)
- ✅ Safe Spine fanout — one module failure does not take down aggregate metrics/actions/health/context
- ✅ AI decision engine (multi-advisor, redaction-gated)
- ✅ Module CRUD + review API routes (auth + RLS + Zod on every write)
- ✅ Dashboard UI + command center
- ✅ Individual module UIs wired through their module/API boundaries
- ✅ Empire conversational intelligence surface
- ✅ Universal input foundation
- ✅ Passkey multi-device pairing plan and implementation path
- ✅ Career Command intelligence helper for fit scoring, pipeline risks, and interview/application next moves
- ✅ Empire Recorder architecture and module path
- ✅ LM Studio local/private provider support path
- 🚧 Empire VNext control plane: governed tools, approvals, receipts, durable runs
- ⏭️ Validation, deployment, and live Supabase wiring next

See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the detailed status and next steps.

## Build Order

1. ✅ Repo / docs organization
2. ✅ Backend spine
3. ✅ Module system
4. ✅ Decision engine
5. ✅ Dashboard UI
6. ✅ Individual module UIs
7. ✅ Empire conversational intelligence surface
8. ✅ Career Command intelligence extraction
9. ✅ Empire Recorder architecture and implementation path
10. ✅ LM Studio provider routing support
11. ✅ Spine/module guardrails and safe module fanout
12. 🚧 Empire governed execution runtime
13. ⏭️ Validation and deployment

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
  -> Send to Empire
  -> Draft approval-gated Spine actions
```

Empire Recorder must be consent-first, owner-only, private-storage-only, and integrated into the existing artifact and Empire runtime instead of becoming a separate AI subsystem.

## Empire Execution Flow

```txt
Owner request
  -> Empire understands intent
  -> Empire plans with registered tools only
  -> Approval policy is enforced
  -> Module service executes
  -> Postcondition is verified
  -> Receipt is stored
  -> Spine is updated
  -> Empire reports proof
```

Empire is not a fictional assistant or a chat theme. It is the real control plane connecting conversation to governed backend execution.

## AI Provider Routing

```txt
Requesty
  -> Anthropic
  -> OpenAI
  -> Google
  -> LM Studio local/private fallback
  -> Groq / Cerebras / OpenRouter / Mistral
  -> Stub fallback
```

LM Studio is useful for local/private desktop workflows, but mobile-only usage still needs Requesty or another cloud provider because the phone does not run the local model by itself.

## Important Docs

- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy + first passkey login
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) — status & next steps
- [`docs/SPINE_MODULE_GUARDRAILS.md`](./docs/SPINE_MODULE_GUARDRAILS.md) — Spine-first module boundaries and best-practice checklist
- [`docs/JOB_HUNT_INTELLIGENCE.md`](./docs/JOB_HUNT_INTELLIGENCE.md) — Career Command / job-hunt intelligence extraction
- [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md) — audio recorder / conversation intelligence architecture
- [`docs/INFERENCE_SERVERS.md`](./docs/INFERENCE_SERVERS.md) — Requesty, LM Studio, and production inference strategy
- [`docs/MENTOR_GENIUS_PROMPT.md`](./docs/MENTOR_GENIUS_PROMPT.md) — Empire mentor behavior standard
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
    ├── SPINE_MODULE_GUARDRAILS.md
    ├── JOB_HUNT_INTELLIGENCE.md
    ├── EMPIRE_RECORDER.md
    ├── INFERENCE_SERVERS.md
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
