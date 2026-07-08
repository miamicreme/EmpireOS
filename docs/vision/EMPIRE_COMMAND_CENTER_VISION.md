# Empire Command Center Vision

EmpireOS should pivot into the **Empire Command Center**.

This is the strongest direction because the current build already has the hard foundation: Spine, modules, AI Chief of Staff, action drafts, provider management, universal input, camera/input surfaces, safe run details, durable memory, and approval-gated actions.

The next move is not to bolt on a generic agent desktop. The next move is to turn EmpireOS into a private command center where the owner directs AI teams through the Spine.

## One-Sentence Vision

> EmpireOS is a private command center where all context becomes intelligence, intelligence becomes ranked decisions, decisions become approved missions, and AI teams execute those missions under owner control.

## Product Thesis

Most AI systems either chat, track, or automate.

EmpireOS should do something more powerful:

1. Capture real context.
2. Convert context into artifacts.
3. Let the Spine rank what matters.
4. Let the AI Decision Engine draft decisions and actions.
5. Let the owner approve.
6. Let AI Teams execute approved missions.
7. Review every result before it affects the empire.

## Current Build Reality

EmpireOS is already positioned for this pivot.

Built foundation:

- Spine owns priority.
- Six modules own domain detail.
- AI Decision Engine reasons through a multi-advisor panel.
- AI Chief of Staff drafts ranked actions.
- Universal Input creates artifacts from documents, spreadsheets, screenshots, camera snapshots, video-frame samples, and transcript-like payloads.
- Owner UI surfaces exist for input, camera, runs, memory, providers, and security.
- AI command execution is already centralized through `POST /api/ai/agent/run`.
- Action drafts require approval before becoming real actions.

## What Changes

Old direction:

> Add more modules and dashboards.

New direction:

> Build an owner-controlled AI company inside EmpireOS.

The modules remain, but the top-level product becomes a command center that coordinates specialized AI teams.

## The Best Architecture

```txt
Universal Input / Recorder / Camera / Files / Manual Command
  -> Artifact Layer
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

## The Core Product Surfaces

### 1. `/today` — Owner Command Deck

The first page the owner checks.

Shows:

- Empire Score
- top three priorities
- urgent risks
- pending action drafts
- active AI team missions
- missed follow-ups
- cash/deal/career alerts
- one recommended focus

### 2. `/ai/input` — Universal Intake

Already built as the intelligence intake surface. It should become the default capture point for files, screenshots, docs, spreadsheets, camera snapshots, voice transcripts, and future video-frame inputs.

### 3. `/ai/command` — Mission Console

A new focused command interface.

The owner gives a high-level mission:

```txt
Analyze this deal and find the best buyer angle.
Prepare my STT discovery plan.
Turn this bug video into tasks for the Product Builder Team.
Review my cash situation and tell me what must happen today.
```

EmpireOS routes the mission through the Spine and creates a pending mission brief.

### 4. `/ai/teams` — AI Teams Dashboard

Shows all AI teams, current missions, task status, blockers, messages, and review queue.

### 5. `/ai/review` — Owner Approval Queue

One place to approve, reject, edit, or request revision for:

- action drafts,
- agent outputs,
- proposed emails/messages,
- generated tasks,
- deal recommendations,
- prompt changes,
- risky automations.

### 6. `/ai/runs/[id]` — Safe Run Detail

Already exists. It should remain the audit-grade run detail page: summaries, artifact references, events, drafts, and metadata only. No raw chain-of-thought, secrets, or raw prompts.

## The AI Team Model

AI Teams are not autonomous rulers. They are execution squads.

They receive:

- a Spine-approved mission,
- allowed modules,
- input artifacts,
- constraints,
- autonomy level,
- required review gate.

They produce:

- task plan,
- work artifacts,
- findings,
- risk notes,
- action drafts,
- review package.

## Strategic Rule

> AI Teams can plan and execute. Only the owner can approve high-impact action.

## The EmpireOS Moat

The power is not the agents by themselves.

The moat is the combination of:

- private owner context,
- artifact memory,
- module-specific data,
- deterministic derived facts,
- redaction gates,
- ranked Spine actions,
- approval workflow,
- AI teams that execute within boundaries,
- audit trails that make the system trustworthy.

## What Not To Build

Do not build:

- a generic Agent Teams AI clone,
- a prompt engineering playground as the main product,
- a public SaaS marketplace,
- unbounded autonomous agents,
- another unrelated command path,
- a chat UI that bypasses action drafts,
- a video/camera system that silently records,
- multi-user team management before the private owner OS is excellent.

## Best Product Name For This Pivot

Keep the repo/product as **EmpireOS**.

Use this internal product layer name:

> **Empire Command Center**

Use this module name:

> **AI Teams**

Use this execution object:

> **Mission**

## Operating Model

```txt
Owner gives command
  -> EmpireOS creates mission brief
  -> Spine ranks mission priority
  -> AI Decision Engine validates mission and risks
  -> Owner approves mission
  -> AI Team executes tasks
  -> Output enters review queue
  -> Owner approves/rejects/revises
  -> Approved action updates Spine/module state
```

## Success Criteria

This pivot is successful when EmpireOS can:

- tell the owner what matters today,
- ingest context from real files and camera/input flows,
- draft the next best actions,
- route work to the right AI team,
- show what each team is doing,
- prevent unsafe autonomous execution,
- turn agent output into reviewable artifacts,
- update the Spine only after approval,
- learn from accepted/rejected decisions.

## Priority Build Path

1. Finish validation of current AI owner surfaces.
2. Add mission data model on top of existing agent run/action draft infrastructure.
3. Add `/ai/command` mission console.
4. Add `/ai/teams` dashboard.
5. Add `/ai/review` unified approval queue.
6. Add first three teams: Chief of Staff, Research Intelligence, Product Builder.
7. Add DealFlow and Money teams after the first team loop works.

## Final Direction

EmpireOS should become a private AI-run command center for the owner.

Not a tracker.
Not a prompt workbench.
Not a generic agent swarm.

A private operating system where AI teams execute the owner's approved missions and every action moves the empire forward.
