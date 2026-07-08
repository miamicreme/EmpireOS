# AI Teams Mission Architecture

AI Teams are the controlled execution layer of EmpireOS.

They should be built on top of the existing AI command path, action drafts, artifacts, provider management, memory, and safe run details. Do not create a second AI subsystem.

## Core Rule

> The Spine owns priority. The owner approves missions. AI Teams execute within scope.

## Why This Architecture Fits EmpireOS

EmpireOS already has:

- `POST /api/ai/agent/run` as the canonical AI command path.
- compact `agent_*` runtime tables.
- safe run detail responses.
- `ai_action_drafts` approval flow.
- durable memory.
- provider health and provider configuration.
- Universal Input artifacts.
- camera and video-frame analysis contracts.
- redaction and high-risk secret blocking.

AI Teams should extend this runtime instead of replacing it.

## New Core Objects

### Mission

A mission is an approved work package routed to an AI team.

```ts
type AiMission = {
  id: string;
  ownerId: string;
  title: string;
  objective: string;
  source: 'manual' | 'spine_action' | 'artifact' | 'recorder' | 'module' | 'daily_brief';
  status: 'draft' | 'pending_approval' | 'approved' | 'running' | 'review' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  teamId: string;
  moduleIds: string[];
  inputArtifactIds: string[];
  linkedActionDraftIds: string[];
  autonomyLevel: 'manual' | 'supervised' | 'review_required' | 'autonomous_limited';
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### Team

```ts
type AiTeam = {
  id: string;
  ownerId: string;
  name: string;
  purpose: string;
  defaultAutonomyLevel: AiMission['autonomyLevel'];
  allowedModuleIds: string[];
  allowedActionTypes: string[];
  active: boolean;
};
```

### Team Member

```ts
type AiTeamMember = {
  id: string;
  teamId: string;
  name: string;
  role: string;
  lens: string;
  modelPreference?: string;
  systemInstructionVersionId?: string;
};
```

### Mission Task

```ts
type AiMissionTask = {
  id: string;
  missionId: string;
  title: string;
  description: string;
  status: 'backlog' | 'ready' | 'running' | 'review' | 'done' | 'blocked';
  assignedMemberId?: string;
  dependsOnTaskIds: string[];
  outputArtifactIds: string[];
  reviewNotes?: string;
};
```

## Recommended Tables

```txt
ai_teams
ai_team_members
ai_missions
ai_mission_tasks
ai_team_messages
ai_mission_reviews
ai_mission_events
```

All tables must be owner-scoped, RLS-isolated, Zod-validated, and audit-logged.

## Mission Lifecycle

```txt
draft
  -> pending_approval
  -> approved
  -> running
  -> review
  -> done
```

Side states:

```txt
blocked
cancelled
```

## Runtime Flow

```txt
Owner command or Spine action
  -> Create mission draft
  -> Attach input artifacts and module context
  -> AI Decision Engine validates mission scope/risk
  -> Owner approves mission
  -> Team generates task plan
  -> Tasks run through canonical agent command path
  -> Outputs become artifacts/action drafts
  -> Review queue packages evidence
  -> Owner approves/rejects/revises
  -> Spine/module state updates
```

## First Five AI Teams

### 1. Chief of Staff Team

Purpose: daily planning, priority triage, follow-ups, risk/opportunity scan.

Members:

- Lead Chief of Staff
- Follow-Up Agent
- Risk/Opportunity Agent
- Drafting Agent

Default autonomy: `supervised`

### 2. Research Intelligence Team

Purpose: turn documents, web/social/video signals, uploaded files, camera snapshots, and transcripts into grounded briefs.

Members:

- Signal Analyst
- Document Analyst
- Vision/Frame Analyst
- Synthesis Agent

Default autonomy: `review_required`

### 3. Product Builder Team

Purpose: turn product ideas and repo work into specs, branch plans, implementation tasks, tests, and launch checklists.

Members:

- Product Architect
- Frontend Agent
- Backend Agent
- QA/Review Agent
- Release Agent

Default autonomy: `review_required`

### 4. DealFlow Team

Purpose: analyze real estate/business opportunities, buyer fit, risks, missing diligence, and outreach angles.

Members:

- Deal Analyst
- Buyer Match Agent
- Diligence Agent
- Outreach Agent

Default autonomy: `supervised`

### 5. Money Team

Purpose: cash flow triage, bills, credit/funding, income opportunities, financial risk.

Members:

- CFO Agent
- Cash Flow Agent
- Credit/Funding Agent
- Opportunity Agent

Default autonomy: `manual` or `supervised`

## Later Teams

- Career Team
- Family/Home Ops Team
- Health Discipline Team
- Content/Brand Team
- AI Consulting Team
- Legal/Admin Prep Team

## Autonomy Levels

| Level | Meaning | Allowed Behavior |
|---|---|---|
| manual | Owner must approve every step | draft only |
| supervised | Agent can research/plan, owner approves outputs | artifacts and drafts |
| review_required | Agent can complete tasks, outputs wait for review | artifacts, proposed changes, action drafts |
| autonomous_limited | Agent can execute low-risk approved tasks inside strict boundaries | only allow-listed actions |

Default should be conservative. Start with `manual`, `supervised`, and `review_required` only.

## Review Gate

Every mission should end with a review package:

```ts
type MissionReviewPackage = {
  missionId: string;
  summary: string;
  outputs: ArtifactSummary[];
  actionDrafts: ActionDraftSummary[];
  risks: string[];
  assumptions: string[];
  recommendedApproval: 'approve' | 'revise' | 'reject';
  nextSteps: string[];
};
```

## UI Surfaces

### `/ai/command`

Create a mission from a natural-language command, selected module, and optional artifacts.

### `/ai/teams`

View teams, active missions, members, current status, blockers, and recent outputs.

### `/ai/missions/[id]`

Mission detail: objective, input artifacts, task board, team messages, events, outputs, review package.

### `/ai/review`

Unified approval queue for action drafts, mission reviews, generated messages, and proposed changes.

### `/today`

Owner command deck: top priorities, active missions, pending reviews, urgent risks.

## Guardrails

1. Do not bypass `POST /api/ai/agent/run`.
2. Do not send raw secrets or unredacted context to providers.
3. Do not allow teams to mutate money, email, calendar, repo, or database records without approval.
4. Do not silently activate camera, audio, or video collection.
5. Do not store raw chain-of-thought.
6. Do not return raw prompts or provider outputs to the client.
7. Do not let modules override Spine priority.
8. Do not let agents create real `global_action` records directly; use action drafts and approval.

## MVP Build Order

### Slice 1 — Mission model

- Add tables for teams, team members, missions, tasks, events, reviews.
- Seed five default teams for owner.
- Add RLS and Zod schemas.

### Slice 2 — Mission creation

- Add `POST /api/ai/missions`.
- Create mission draft from command, module, and `inputArtifactIds`.
- Add approval transition.

### Slice 3 — Team dashboard

- Add `/ai/teams` and `/ai/missions/[id]`.
- Show team cards, active missions, and mission tasks.

### Slice 4 — Agent run integration

- Route approved mission tasks through `POST /api/ai/agent/run`.
- Save outputs as artifacts and action drafts.

### Slice 5 — Review queue

- Add `/ai/review`.
- Package mission output for approve/revise/reject.

### Slice 6 — First production team

Start with Chief of Staff Team because it connects to current AI V2 immediately.

Then add Research Intelligence Team because it connects to Universal Input.

Then add Product Builder Team because it creates visible software leverage.

## Best MVP Team Order

1. Chief of Staff Team
2. Research Intelligence Team
3. Product Builder Team
4. DealFlow Team
5. Money Team

## Final Shape

EmpireOS AI Teams should feel like the owner has a private staff:

- they read the context,
- prepare the work,
- execute safe slices,
- surface risk,
- ask for approval,
- and update the Spine only after review.

The result is controlled leverage, not chaos.
