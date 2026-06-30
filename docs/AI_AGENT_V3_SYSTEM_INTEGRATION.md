# Empire OS V3 System Integration Standard — One Brain, Not Feature Soup

## Purpose

V3 must not become a pile of AI features. V3 must become one **agentic operating loop** that coordinates the existing Spine, Modules, V2 AI services, provider routing, memory, research, and approval-gated actions.

The app should feel like one intelligent system, not separate pages named AI Brief, AI Chat, Recommendations, and Copilots.

## North Star

```txt
User gives one short command.
Agent understands intent.
Agent gathers context.
Agent knows what is missing.
Agent gets or requests data.
Agent reasons through the problem.
Agent drafts actions.
User approves.
Spine executes.
System learns.
```

## Core Integration Rule

```txt
One Orchestrator owns the AI run.
The Spine owns priority.
Modules own detail.
Memory owns stable user context.
Research owns fresh/current facts.
Provider Router owns model selection.
Specialists own domain analysis.
Final Synthesizer owns the final answer.
Action Drafts own execution proposals.
Approval owns permission to act.
Audit owns accountability.
```

## Single Runtime Flow

Every AI command should enter through one main orchestrator:

```txt
POST /api/ai/agent/run
  -> runEmpireAgent()
  -> Intent Router
  -> Capability Planner
  -> Context Pack Builder
  -> Memory Manager
  -> Research Router
  -> Provider Router
  -> Specialist Council when needed
  -> Final Synthesizer
  -> Action Draft + Approval Layer
  -> Audit + Learning Loop
```

The existing AI V2 endpoints may remain, but V3 should gradually route them through the shared agent services instead of each endpoint inventing its own logic.

## The AI Run Contract

A V3 agent run must produce a structured result:

```ts
export type AgentRunResult = {
  runId: string;
  sessionId: string;
  turnId: string;
  mode: 'fast_path' | 'standard_path' | 'deep_path' | 'research_required' | 'memory_required' | 'approval_required';
  intent: AgentIntent;
  stakes: 'low' | 'medium' | 'high';
  directAnswer: string;
  executiveSummary: string;
  recommendedFocus?: string;
  topActions: ActionDraftCandidate[];
  risks: string[];
  opportunities: string[];
  assumptions: string[];
  missingMemory: MemoryRequestCandidate[];
  researchNeeded: ResearchRequestCandidate[];
  sourcesUsed: SourceSummary[];
  specialistVotes: SpecialistVoteSummary[];
  providerRuns: ProviderRunSummary[];
  capabilityPlan: CapabilityPlanSummary;
  decisionLog: DecisionLogEntry[];
  confidence: number;
};
```

Do not return unstructured text only. The UI can render a concise answer, but the backend must retain the structured run.

## Cognitive Loop

The agent must reason through complex problems with this loop:

```txt
1. Understand — classify user command, intent, stakes, domain, requested outcome.
2. Scope — decide what data, memory, research, specialists, and tools are needed.
3. Retrieve — gather safe internal data from Spine, Modules, Memory, prior decisions.
4. Verify — decide if fresh facts or source-backed research is required.
5. Model — build a problem model with assumptions, constraints, options, risks.
6. Analyze — run specialists, calculations, scoring, tradeoff analysis, and critic review.
7. Synthesize — produce one recommendation with confidence and uncertainty.
8. Draft — create internal action drafts, research requests, or memory requests.
9. Approve — wait for user approval before external/irreversible execution.
10. Learn — log outcome, feedback, accepted/rejected actions, memory candidates.
```

This is the default for all non-trivial runs. Fast-path runs may compress steps, but they must still use the same orchestrator.

## Shared Internal Objects

Use these objects across all V3 services so everything works together:

```txt
AgentCommand       -> raw user command + metadata
AgentIntent        -> interpreted purpose
AgentMode          -> routing class
CapabilityPlan     -> what internal/external capabilities are needed
ContextPack        -> redacted compact facts for AI
ProblemModel       -> assumptions, constraints, unknowns, options
SpecialistVote     -> expert perspective
FinalSynthesis     -> reconciled answer
ActionDraft        -> proposed internal action
ResearchRequest    -> request for current/source-backed facts
MemoryRequest      -> request to save/retrieve stable context
AgentRunLog        -> audit and telemetry
```

## Existing V2 Services Must Be Reused

V3 should reuse or wrap:

```txt
src/spine/ai/context/empire-context.service.ts
src/spine/ai/context/context-snapshot.service.ts
src/spine/ai/chief-of-staff.service.ts
src/spine/ai/daily-brief.service.ts
src/spine/ai/recommendation.service.ts
src/spine/ai/action-draft.service.ts
src/spine/ai/module-copilot.service.ts
src/spine/ai/provider.ts
src/spine/ai/usage.service.ts
src/spine/ai/redaction.ts
```

Do not duplicate provider logic. Do not create a second memory format if the V3 memory schema already exists. Do not bypass action drafts.

## Unified UI Standard

The user should not need to think about which AI page to use.

Primary UI:

```txt
/app/ai/agent
```

Main components:

```txt
AgentCommandBar        -> one-line command input
AgentQuickActions      -> one-tap commands
AgentResponsePanel     -> concise answer + expandable detail
AgentPlanPanel         -> what the agent decided to do
AgentControlPanel      -> memory/research/tool access requests
ActionDraftApprovalBar -> approve/edit/reject actions
AgentSessionTimeline   -> prior turns and decisions
```

Existing AI pages can link into or display filtered views of the same agent run records.

## No Feature Soup Rule

Do not implement isolated AI features unless they plug into:

```txt
Agent Orchestrator
Capability Control Plane
Memory/Research gates
Provider Router
Action Draft approval
Audit log
```

If a feature cannot be reached from `/api/ai/agent/run` or cannot produce structured records, it is not complete.

## Completion Definition

V3 is integrated only when these commands all work through the same orchestrator:

```txt
What should I do today?
Find cash fastest.
Analyze this funding move.
Should I trade this setup?
What changed politically that matters to my business?
Research this acquisition.
Save this as memory.
Draft my next 5 actions.
```

Each command should either:

```txt
answer with structured reasoning summary,
request one or two missing memories,
request current research with source requirements,
or create approval-gated action drafts.
```
