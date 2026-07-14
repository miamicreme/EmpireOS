# EmpireOS VNext — Implementation Plan

This is the approved execution order. Work is incremental; working modules are preserved while control converges behind Jarvis.

## Program 0 — Freeze and inspect

Deliverables:

- Current system map
- Backend risk register
- Capability reality matrix
- Generated route/table/storage/write inventory
- Duplicate AI path report
- Stub/fake-success report
- External-side-effect inventory

Exit gate:

```txt
Every write path has an owner.
Every AI entry point is classified.
Every stub path is visible.
Every external effect is identified.
```

## Program 1 — Backend foundations

Deliverables:

- GitHub Actions validation pipeline
- Shared trace context
- Standard error/result contract
- Honest capability-unavailable contract
- Authorization boundary audit
- Migration/RLS validation harness
- Idempotency utility
- Operation receipt schema

Exit gate:

```txt
CI is green.
Render is no longer the first compiler.
No synthetic fallback can be presented as real completion.
```

## Program 2 — Tool Gateway

Create:

```txt
src/spine/tools/tool.types.ts
src/spine/tools/tool-registry.ts
src/spine/tools/tool-policy.ts
src/spine/tools/tool-executor.ts
src/spine/tools/tool-audit.ts
```

Initial tools:

```txt
recorder.get
recorder.getAnalysis
spine.listActions
spine.createActionDraft
spine.getTodayContext
```

Exit gate:

```txt
The model can select only registered tools.
Inputs and outputs validate.
Every run is authorized, traced, timed, and audited.
```

## Program 3 — Approval Engine

Deliverables:

- Approval request schema/table/service
- Tool risk policy
- Immutable argument hash
- Expiry and single-use consumption
- Approve/reject UI cards
- Replay/mutation tests

Exit gate:

```txt
An approved operation cannot be changed after approval.
A used, expired, rejected, or mismatched approval cannot execute.
```

## Program 4 — Unified Jarvis Runtime

Routes:

```txt
POST /api/jarvis/runs
GET /api/jarvis/runs/[id]
POST /api/jarvis/runs/[id]/continue
POST /api/jarvis/runs/[id]/cancel
```

Runtime stages:

```txt
understanding
planning
awaiting_approval
executing
verifying
completed
failed
cancelled
```

Exit gate:

```txt
One read workflow and one approval-gated write workflow pass end to end.
```

## Program 5 — Spine VNext

Deliverables:

- Explainable scoring components
- Conflict and duplicate detection
- Blocked/stale work detection
- Daily operating brief
- Outcome feedback
- Degraded-module confidence controls

Exit gate:

```txt
Every priority recommendation exposes evidence and score components.
```

## Program 6 — Recorder productionization

Deliverables:

- Honest transcription failure state
- Durable transcription/translation/analysis jobs
- Upload and processing progress
- Retry/cancel
- Interrupted-recording recovery
- Evidence links and transcript versions
- Action-draft tool integration
- Real iPhone manual test

Exit gate:

```txt
A real iPhone recording becomes a verified transcript, analysis, approved follow-up draft, and Spine update.
```

## Program 7 — Module normalization

Normalize in value order:

```txt
Career Command
Follow-Up CRM
Projects
Deal Intelligence
Cash Engine
Finances
Credit & Funding
Acquisitions
```

Each module gains:

```txt
repository
service
tools
permissions
events
health
metrics
decision context
tests
```

Exit gate per module:

```txt
Jarvis accesses the module only through registered tools and safe read context.
```

## Program 8 — Memory

Deliverables:

- Session, working, episodic, semantic, evidence, and procedural memory types
- Source/confidence/sensitivity/validity fields
- Suggest/approve/correct/dispute/supersede/forget controls
- Injection-resistant memory mutation policy

Exit gate:

```txt
The owner can inspect, correct, restrict, and forget anything Jarvis remembers.
```

## Program 9 — UX replacement

Primary navigation:

```txt
Today
Jarvis
Capture
Work
History
```

Normal surfaces show:

```txt
result
proof
next action
approval
operation progress
```

Infrastructure moves to System Control.

Exit gate:

```txt
A first-time owner understands what to do within five seconds.
```

## Program 10 — Security and production proof

Required proof:

- IDOR/RLS tests
- Approval replay/mutation tests
- Tool privilege tests
- Prompt-injection tests
- SSRF tests
- Upload validation tests
- Duplicate execution tests
- Provider fallback tests
- Queue recovery tests
- Production smoke test
- Mobile recorder test

Exit gate:

```txt
No critical findings.
No unapproved sensitive writes.
No cross-user access.
No fake completion.
Clean deploy and smoke tests.
```

## Branch policy

```txt
feature branch
→ pull request
→ CI
→ preview/smoke validation
→ approval
→ main
```

Direct-to-main feature changes are suspended during VNext foundation work.

## First implementation sprint

1. Add CI.
2. Add typed capability-unavailable result.
3. Remove recorder fake transcript success.
4. Add trace context and operation receipt primitives.
5. Add Tool Gateway contracts.
6. Register first recorder and Spine tools.
7. Add tests.
8. Open PR for review; do not merge until green.
