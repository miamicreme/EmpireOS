# EmpireOS VNext — Current System Map

Status: initial verified baseline for Program 0 (Freeze and Inspect).

## Product reality

EmpireOS currently contains a strong collection of modules, APIs, AI services, and owner-only workflows, but the experience is page-centric and the AI control plane is fragmented across several service paths. VNext will preserve working domain functionality while converging execution behind one governed Jarvis runtime.

## Current architectural layers

```txt
Experience
  Next.js pages and workbenches

API
  Next.js route handlers under src/app/api

Spine
  module registry
  global actions
  decisions
  metrics
  events
  agent runtime

Modules
  cash-engine
  finances
  job-hunt
  followup-crm
  credit-funding
  projects
  acquisitions
  deal-intel
  recorder

AI
  provider abstraction
  Requesty and direct provider fallbacks
  compact agent runtime
  universal input
  action drafts
  memory
  recorder transcription/translation/analysis

Data
  Supabase/PostgreSQL
  RLS
  private Storage
  migrations
```

## Registered functional modules

| Module | Primary responsibility | Spine participation |
| --- | --- | --- |
| Cash Engine | near-term cash execution | metrics, actions, decisions, health |
| Finances | factual financial records and context | metrics, actions, decisions, health |
| Job Hunt / Career Command | job pipeline and career execution | metrics, actions, decisions, health |
| Follow-Up CRM | contacts and follow-ups | metrics, actions, decisions, health |
| Credit & Funding | credit and funding readiness | metrics, actions, decisions, health |
| Projects | project execution | metrics, actions, decisions, health |
| Acquisitions | acquisition targets | metrics, actions, decisions, health |
| Deal Intelligence | deal analysis | metrics, actions, decisions, health |
| Empire Recorder | conversations to transcript and action drafts | metrics, actions, decisions, health |

## Verified strengths

- Modules are registered through `src/spine/module-registry.ts`.
- Owner auth is commonly enforced through `requireUserId`.
- Recorder audio uses private storage and signed URLs.
- Action drafts provide an approval-oriented path instead of direct autonomous action creation.
- Universal input feeds artifacts into the existing agent runtime.
- Provider keys are server-side and can be stored encrypted.
- RLS migrations exist for core modules and AI/provider data.
- The repository has a broad Vitest suite and has previously passed full local validation.

## Current AI entry points that require convergence

The repository includes multiple AI-facing service and route families, including:

```txt
/api/ai/agent/*
/api/ai/chief-of-staff
/api/ai/recommendations
/api/ai/action-drafts
/api/ai/input/*
/api/ai/providers/*
module-specific AI helpers
recorder transcription/translation/analysis routes
```

These are not automatically wrong, but VNext requires one authoritative orchestration path for user intent, planning, governed tool execution, approval, verification, and receipts.

## Current recorder flow

```txt
record in browser
→ upload private audio
→ transcribe
→ translate
→ analyze
→ create action drafts
→ approve/reject
```

Current gap: transcription can degrade to deterministic stub output. VNext must return an explicit unavailable state instead of saving or presenting fake transcript content as if it were operational evidence.

## Current provider flow

```txt
Requesty
→ Anthropic
→ OpenAI
→ Google
→ LM Studio
→ Groq
→ Cerebras
→ OpenRouter
→ Mistral
→ stub
```

Current gap: one global order is too coarse for all capabilities. Speech, vision, deep reasoning, structured extraction, and fast classification require capability-specific routing and compatibility checks.

## Target convergence

```txt
Owner request
→ Jarvis Runtime
→ intent and plan
→ Tool Gateway
→ policy and approval
→ module service
→ verification
→ operation receipt
→ event ledger
→ Spine priority refresh
→ Jarvis response
```

## Program 0 remaining inventory work

- Enumerate all API routes and classify read/write/auth behavior.
- Enumerate all database tables, policies, functions, and storage buckets.
- Enumerate all direct database writes outside module repositories/services.
- Enumerate all AI entry points and duplicated orchestration logic.
- Enumerate all stub, mock, fallback, placeholder, and synthetic-success paths.
- Enumerate all external side effects and whether they are approval-gated.
- Enumerate all long-running operations still executed inline in HTTP handlers.
- Generate `artifacts/system-inventory.json` from the repository rather than maintaining it by hand.
