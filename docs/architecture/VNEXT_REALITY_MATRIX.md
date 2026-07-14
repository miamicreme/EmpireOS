# EmpireOS VNext — Capability Reality Matrix

This document separates what exists from what is proven. Status values:

```txt
PROVEN       verified by implementation and prior successful validation
FUNCTIONAL   implementation exists but current branch validation is not complete
PARTIAL      some of the workflow exists; important gaps remain
STUB         synthetic or non-production fallback exists
PLANNED      architecture only
UNKNOWN      not yet inventoried deeply enough
```

| Capability | Status | Current reality | VNext requirement |
| --- | --- | --- | --- |
| Owner authentication | FUNCTIONAL | Passkey/WebAuthn and owner session paths exist | Re-run real device enrollment/login/recovery tests and authorization review |
| Module registry | FUNCTIONAL | Registered modules implement `ModuleContract`; safe fanout added | Add executable registry tests and module conformance validation |
| Global actions | FUNCTIONAL | Spine-owned action queue exists | Ensure every AI-created action starts as an approval-gated draft |
| Decisions | FUNCTIONAL | Decision records, options, votes, analysis routes exist | Route decision requests through Jarvis and preserve evidence/receipts |
| Compact agent runtime | FUNCTIONAL | Agent runs, artifacts, memory, action drafts, synthesis exist | Make it the foundation of one authoritative Jarvis runtime rather than one of several AI surfaces |
| Jarvis natural-language control | PARTIAL | AI console can reason and return structured mentor output | Add governed tools, exact approvals, verification, receipts, cancellation, and progress |
| Tool Gateway | PLANNED | No universal registered execution control plane is proven | Implement typed tool registry/executor/policy/audit contracts |
| Universal Approval Engine | PLANNED | Action-draft approval exists, but not universal exact-operation approval | Build immutable single-use approvals for all medium/high-risk operations |
| Operation receipts | PARTIAL | Events and run artifacts exist | Create verified receipt object for every side effect |
| Event ledger | PARTIAL | System events and agent events exist | Normalize trace IDs and append-only lifecycle across all control-plane operations |
| Requesty routing | FUNCTIONAL | OpenAI-compatible Requesty path and model roles exist | Add measured health, capability routing, circuit breaker, and compatibility policy |
| Direct cloud provider fallback | FUNCTIONAL | Anthropic, OpenAI, Google and compatible providers exist | Route per capability and preserve feature compatibility during fallback |
| LM Studio local provider | FUNCTIONAL | Server-side OpenAI-compatible adapter and private-host policy exist | Unit-test network policy and keep it optional, not production primary |
| Speech transcription | PARTIAL / STUB | OpenAI Whisper works when configured; deterministic stub returned otherwise | Remove fake transcript output; return explicit unavailable state; move to durable job |
| Translation | FUNCTIONAL | Recorder translation service/route exists | Move to job orchestration and capability-specific provider policy |
| Recorder analysis | FUNCTIONAL | Structured conversation analysis and action drafts exist | Add evidence provenance, job progress, speaker model, and end-to-end mobile proof |
| Mobile recorder | FUNCTIONAL | Record/pause/resume/stop/upload UI exists | Test interruption recovery, backgrounding, long recordings, Safari permissions, and real iPhone workflow |
| Private audio storage | FUNCTIONAL | Private bucket, owner paths, signed URLs, deletion path exist | Add storage/RLS integration tests, delete verification, and retention controls |
| Universal input | FUNCTIONAL | Upload, camera, document, spreadsheet, video-frame and artifact paths exist | Centralize quarantine, magic-byte validation, sensitivity labels, and injection defenses |
| Memory | PARTIAL | Agent memory CRUD/approval exists | Add source, confidence, validity, supersession, dispute, and owner inspection model |
| Career Command | FUNCTIONAL | Job pipeline and AI helpers exist | Normalize tools, evidence, events, outcomes, and Jarvis commands |
| CRM | FUNCTIONAL | Contact/follow-up domain exists | Normalize tools and commitment extraction from conversations |
| Projects | FUNCTIONAL | Project records/actions exist | Normalize tool surface and evidence-backed progress |
| Deal Intelligence | FUNCTIONAL | Deal analysis and integration routes exist | Inventory calculations, external writes, and tool/approval boundaries |
| Acquisitions | FUNCTIONAL | Target tracking and decisions exist | Normalize tools and due-diligence workflow |
| Cash Engine | FUNCTIONAL | Near-term cash metrics/actions exist | Preserve as strategy layer above factual finances |
| Finances | FUNCTIONAL | Accounts/transactions and AI summary paths exist | Audit data authority and ensure AI does not invent financial facts |
| Credit & Funding | FUNCTIONAL | Domain records/actions exist | Normalize tools and document evidence |
| Background jobs | PARTIAL | Job routes/types exist, but durable processing coverage is unclear | Standardize queue contract, retries, heartbeat, cancellation, dead-letter and progress |
| CI required on main | NOT PRESENT | GitHub status checks are absent; Render has caught compile failures | Add GitHub Actions and branch protection before VNext merge |
| Full production build | UNKNOWN | Last known Render failure was fixed, but clean latest deploy not yet supplied | Require green CI and post-deploy smoke test |
| Dependency security | PARTIAL | npm audit reports known vulnerabilities | Triage exact advisories; upgrade without blind `--force`; add dependency gate |
| UX simplicity | FAILED PRODUCT GOAL | Functional pages exist but owner reports clutter and low value | Replace primary navigation and design around Jarvis outcomes |

## Current functional module list

```txt
Jarvis/Agent runtime
Today / Command Center
Universal Input / Capture
Empire Recorder
Career Command
Follow-Up CRM
Projects
Deal Intelligence
Acquisitions
Cash Engine
Finances
Credit & Funding
Decisions
Actions
Memory
Integrations / Providers
System Control
```

## First vertical slice definition

The first VNext feature is complete only when this real workflow passes:

```txt
Owner: “Create a follow-up action from this recording.”

Jarvis
→ understands intent
→ retrieves the owned recording and verified analysis artifact
→ plans use of a registered recorder read tool and Spine action-draft tool
→ explains exact effect
→ requests approval when required
→ executes through Tool Gateway
→ verifies the action draft exists
→ emits traceable events
→ returns a receipt and evidence link
→ refreshes Spine context
```
