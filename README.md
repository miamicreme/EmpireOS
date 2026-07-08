# Empire OS

Private execution operating system for KJB Empire planning.

## Product Vision

EmpireOS is pivoting into the **Empire Command Center**: a private command system where context becomes intelligence, intelligence becomes ranked decisions, decisions become approved missions, and AI Teams execute those missions under owner control.

See [`docs/vision/EMPIRE_COMMAND_CENTER_VISION.md`](./docs/vision/EMPIRE_COMMAND_CENTER_VISION.md).

## Architecture

- **Spine** — owns priority. The central nervous system that decides what matters now.
- **Modules** — own detail. Domain-specific units of work and state.
- **Universal Input** — normalizes documents, spreadsheets, screenshots, camera frames, video frames, and audio into agent artifacts.
- **Empire Recorder** — planned private conversation-intelligence module for recording interviews/meetings, saving audio, transcribing, translating, analyzing, and drafting follow-ups. See [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md).
- **AI Decision Engine** — a multi-advisor engine that turns information into decisions.
- **AI Chief of Staff / Jarvis-grade Mentor** — the owner-facing intelligence layer that reads context, diagnoses the real issue, maps leverage, spots blind spots, generates briefs, and drafts actions for approval.
- **AI Teams** — planned controlled execution squads that receive approved missions from the Spine, create tasks, generate artifacts, submit outputs for review, and update the system only after owner approval.

Flow: **Inputs create artifacts → Artifacts feed decisions → Decisions create approved missions/actions → AI Teams execute controlled work → Review gates protect the owner → Actions move phases → Phases build the empire.**

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
- 📌 Planned: Empire Recorder conversation-intelligence module
- 📌 Planned: AI Teams mission architecture
- 📌 Planned: Dynamic AI team topology and templates
- ⏭️ Validation, deployment, live Supabase wiring, and AI Teams MVP next

See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the detailed status and next steps.

## Build Order

1. ✅ Repo / docs organization
2. ✅ Backend spine
3. ✅ Module system
4. ✅ Decision engine
5. ✅ Dashboard UI
6. ✅ Individual module UIs
7. ✅ Jarvis-grade AI mentor surface
8. ✅ Universal Input foundation
9. 📌 Empire Recorder architecture and implementation
10. 📌 AI Teams mission architecture and implementation
11. 📌 AI team topology, templates, and org chart
12. ⏭️ Validation and deployment

## Empire Command Center Loop

```txt
Capture
  -> Artifact
  -> AI Chief of Staff
  -> Spine Priority
  -> AI Decision Engine
  -> Owner Approval
  -> Mission Brief
  -> AI Team Execution
  -> Review Queue
  -> Spine Status Update
  -> Memory / Audit / Learning
```

## AI Team Topology

EmpireOS should support as many teams and subteams as needed, but only the relevant teams wake up for the current mission.

```txt
Owner
  -> Spine
    -> AI Chief of Staff
      -> Executive Teams
      -> Domain Teams
      -> Capability Teams
      -> Mission Squads
        -> Subteams
          -> Agents
```

The first active teams should be seeded from templates:

| Team | Mission | Why First |
|---|---|---|
| Chief of Staff Team | Daily planning, triage, follow-ups, risks, opportunities | Extends the current AI V2 directly |
| Research Intelligence Team | Turns documents, uploads, camera/video frames, and transcripts into grounded briefs | Extends Universal Input and artifact flow |
| Product Builder Team | Turns ideas/repos into specs, branch plans, implementation tasks, tests, and launch plans | Creates software leverage |
| DealFlow Team | Analyzes deals, buyer fit, diligence gaps, and outreach angles | Supports MiamiCreme and wealth building |
| Money Team | Cash flow, bills, credit/funding, income opportunities, financial risk | Protects survival and growth |

The full topology includes executive, money, dealflow, product, research, career, operations, family/home, health, brand/content, PromptOps, and security/privacy groups.

See [`docs/architecture/AI_TEAMS_MISSION_ARCHITECTURE.md`](./docs/architecture/AI_TEAMS_MISSION_ARCHITECTURE.md) and [`docs/architecture/AI_TEAM_TOPOLOGY.md`](./docs/architecture/AI_TEAM_TOPOLOGY.md).

## Empire Recorder Pipeline

```txt
Record interview
  -> Save private audio
  -> Transcribe
  -> Translate
  -> Analyze conversation
  -> Create voice_transcript_analysis artifact
  -> Send to AI Chief of Staff / mission flow
  -> Draft approval-gated Spine actions
```

Empire Recorder must be consent-first, owner-only, private-storage-only, and integrated into the existing artifact and agent runtime instead of becoming a separate AI subsystem.

## Important Docs

- [`docs/vision/EMPIRE_COMMAND_CENTER_VISION.md`](./docs/vision/EMPIRE_COMMAND_CENTER_VISION.md) — pivot vision for Empire Command Center
- [`docs/architecture/AI_TEAMS_MISSION_ARCHITECTURE.md`](./docs/architecture/AI_TEAMS_MISSION_ARCHITECTURE.md) — AI Teams mission architecture
- [`docs/architecture/AI_TEAM_TOPOLOGY.md`](./docs/architecture/AI_TEAM_TOPOLOGY.md) — full team/subteam org chart and template strategy
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy + first passkey login
- [`docs/PROGRESS.md`](./docs/PROGRESS.md) — status & next steps
- [`docs/EMPIRE_RECORDER.md`](./docs/EMPIRE_RECORDER.md) — audio recorder / conversation intelligence architecture
- [`docs/MENTOR_GENIUS_PROMPT.md`](./docs/MENTOR_GENIUS_PROMPT.md) — mentor behavior standard
- [`docs/DOCUMENT_INTELLIGENCE.md`](./docs/DOCUMENT_INTELLIGENCE.md) — document intelligence pipeline
- [`docs/API_CONTRACTS.md`](./docs/API_CONTRACTS.md) — canonical AI/API contracts
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
    ├── EMPIRE_RECORDER.md
    ├── MENTOR_GENIUS_PROMPT.md
    ├── DOCUMENT_INTELLIGENCE.md
    ├── API_CONTRACTS.md
    ├── vision/
    │   └── EMPIRE_COMMAND_CENTER_VISION.md
    ├── prompts/
    │   ├── Backend_Spine_Prompt_V3_High_Tech.md
    │   └── Module_System_Prompt_V3_High_Tech.md
    ├── architecture/
    │   ├── ARCHITECTURE.md
    │   ├── SPINE_DESIGN.md
    │   ├── MODULE_DESIGN.md
    │   ├── DECISION_ENGINE.md
    │   ├── AI_TEAMS_MISSION_ARCHITECTURE.md
    │   └── AI_TEAM_TOPOLOGY.md
    └── runbook/
        ├── BRANCHING.md
        ├── RUNBOOK.md
        └── VALIDATION.md
```
