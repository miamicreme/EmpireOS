

## Canonical Source-of-Truth Notice

For V3 implementation, the canonical docs are now:

```txt
docs/AI_AGENT_V3_SOURCE_OF_TRUTH.md
docs/AI_AGENT_V3_GREENFIELD_SCHEMA_PLAN.md
docs/AI_AGENT_V3_END_TO_END_BLUEPRINT.md
docs/AI_AGENT_V3_AI_RUNTIME_OPTIMIZATION.md
docs/AI_AGENT_V3_CONSOLIDATION_MAP.md
```

This document supports those files. If there is a conflict, follow `AI_AGENT_V3_SOURCE_OF_TRUTH.md` and update this document.

# Empire OS V3 Agent Structure Map

This file is the structural blueprint for the V3 AI Agent implementation. It exists so Claude/Cursor can build with less guessing and fewer questions.

## Target File Tree

```txt
src/spine/ai/agent/
  agent.types.ts
  agent.schemas.ts
  intent-router.service.ts
  context-pack.service.ts
  memory-manager.service.ts
  research-router.service.ts
  provider-router.service.ts
  specialist-panel.service.ts
  final-synthesizer.service.ts
  agent-session.service.ts
  agent-orchestrator.service.ts
  agent-budget.service.ts
  agent-cache.service.ts
  prompt-firewall.service.ts
  rate-limit.service.ts
  security-guard.service.ts

src/spine/ai/memory/
  memory.schemas.ts
  memory.service.ts
  memory.types.ts

src/spine/ai/research/
  research.schemas.ts
  research.service.ts
  research.types.ts

src/spine/ai/providers/
  provider-routing.types.ts
  provider-health.service.ts
  provider-timeout.service.ts

src/spine/ai/specialists/
  specialist.types.ts
  specialist-prompts.ts
  specialist-registry.ts

src/app/api/ai/agent/run/route.ts
src/app/api/ai/agent/sessions/route.ts
src/app/api/ai/agent/sessions/[id]/route.ts
src/app/api/ai/agent/sessions/[id]/turns/route.ts
src/app/api/ai/memory/route.ts
src/app/api/ai/memory/[id]/route.ts
src/app/api/ai/research/requests/route.ts
src/app/api/ai/research/requests/[id]/route.ts
src/app/api/ai/research/requests/[id]/complete/route.ts
src/app/api/ai/provider-router/test/route.ts

src/app/ai/agent/page.tsx
src/app/ai/memory/page.tsx
src/app/ai/research/page.tsx
src/app/ai/provider-router/page.tsx

src/components/ui/ai/AgentCommandBar.tsx
src/components/ui/ai/AgentQuickActions.tsx
src/components/ui/ai/AgentResponsePanel.tsx
src/components/ui/ai/AgentSessionTimeline.tsx
src/components/ui/ai/MemoryRequestCard.tsx
src/components/ui/ai/ResearchRequestCard.tsx
src/components/ui/ai/SpecialistVotesPanel.tsx
src/components/ui/ai/ProviderConfidencePanel.tsx
src/components/ui/ai/ActionDraftApprovalBar.tsx
```

## Data Flow

```txt
User command
  -> AgentCommandBar
  -> POST /api/ai/agent/run
  -> runEmpireAgent()
  -> Intent Router
  -> Empire Context + Memory Manager
  -> Research Router
  -> Provider Router
  -> Specialist Panel if needed
  -> Final Synthesizer
  -> Action Drafts
  -> AgentResponsePanel
```

## Key Types

```ts
export type AgentMode = 'answer' | 'research_needed' | 'memory_needed' | 'approval_needed' | 'error';
export type AgentStakes = 'low' | 'medium' | 'high';
export type AgentIntent =
  | 'execution'
  | 'cash'
  | 'job_hunt'
  | 'followup'
  | 'credit_funding'
  | 'business_strategy'
  | 'acquisitions'
  | 'stock_trading'
  | 'finance'
  | 'politics_regulation'
  | 'legal_compliance'
  | 'project_build'
  | 'memory_update'
  | 'research_request';
```

## Agent Response Shape

```ts
export type AgentRunResponse = {
  mode: AgentMode;
  sessionId: string;
  turnId: string;
  executiveSummary: string;
  directAnswer: string;
  recommendedFocus?: string;
  topActions: ActionDraftCandidate[];
  risks: string[];
  opportunities: string[];
  missingMemory: MemoryRequestCandidate[];
  researchNeeded: ResearchRequestCandidate[];
  assumptions: string[];
  confidence: number;
  specialistVotes?: SpecialistVoteSummary[];
  providerRuns?: ProviderRunSummary[];
};
```

## Runtime Class Matrix

```txt
fast_path -> low-stakes execution, one provider, compact context, target 2-5s
standard_path -> business/cash/career/project planning, 1-2 specialists, target 5-15s
deep_path -> finance/trading/credit/legal/politics/acquisitions, council + critic + judge, target 15-45s
research_required -> current facts required, create research request, do not fake answer
```

## Security Services

```txt
prompt-firewall.service.ts -> separates trusted policy from untrusted retrieved/user content
security-guard.service.ts -> redaction, high-risk secret blocking, approval gate checks
rate-limit.service.ts -> per-user expensive-route protection placeholder or implementation
agent-budget.service.ts -> provider call/token/latency budgets
agent-cache.service.ts -> compact context/session cache helpers
provider-health.service.ts -> timeout/fallback/circuit-breaker state
```

## Provider Routing Matrix

```txt
low stakes/simple -> one fast provider or stub
medium stakes/business -> domain specialist + Claude final synthesis
high stakes/finance/trading/credit/legal/politics -> specialist council + critic + final judge
current data -> research request or research adapter first
long documents -> Gemini/long-context provider path
math-heavy finance -> reasoning provider path
```

## Memory Escalation Matrix

```txt
missing stable user fact -> memory_needed card
stable user-provided fact -> suggest saving memory
conflicting memory -> ask the user which is current
sensitive/high-risk memory -> do not persist raw value
```

## Research Escalation Matrix

```txt
current market/trading -> require fresh data
current politics/regulation -> require fresh sources
current lender/credit product terms -> require fresh sources
current real estate comps -> require fresh comps
unknown or stale facts -> research_needed mode
```

## Approval Matrix

```txt
safe internal recommendation -> answer directly
internal action draft -> create ai_action_draft
external action -> draft only, user approves
money/trade/legal/funding action -> approval required + risk note
irreversible destructive action -> do not execute automatically
```

## Performance Gate

```txt
fast_path must not run full specialist council
high-stakes path must include risk/compliance and final judge
provider calls must have timeout/fallback wrappers
provider runs must log latency/status/cost fields
context sent to providers must be compact and redacted
V3 tables must include user_id/status/created_at indexes where relevant
```

## Completion Gate

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

No feature is complete until the gate passes.


## Integration Addendum — Capability and Reasoning Services

Add these services to the target file tree if not already present:

```txt
src/spine/ai/agent/capability-registry.service.ts
src/spine/ai/agent/capability-planner.service.ts
src/spine/ai/agent/capability-executor.service.ts
src/spine/ai/agent/permission-policy.service.ts
src/spine/ai/agent/problem-frame.service.ts
src/spine/ai/agent/reasoning-artifact.service.ts
src/spine/ai/agent/source-evaluation.service.ts
```

Add these UI pieces:

```txt
src/components/ui/ai/AgentPlanPanel.tsx
src/components/ui/ai/AgentControlPanel.tsx
src/components/ui/ai/AccessNeededCard.tsx
src/components/ui/ai/CapabilityPlanPanel.tsx
src/components/ui/ai/SourceQualityPanel.tsx
```

Add or verify these persisted structures:

```txt
agent_capability_plans
agent_tool_runs
agent_reasoning_artifacts
agent_source_evaluations
agent_feedback
```

The central orchestration contract is:

```txt
runEmpireAgent(command)
  -> intent
  -> capabilityPlan
  -> contextPack
  -> memory/research gates
  -> provider/specialist run
  -> final synthesis
  -> action drafts
  -> audit log
```

## Compact Structure Addendum

Use the compact V3 runtime:

```txt
agent_threads
agent_runs
agent_run_events
agent_context_packs
agent_artifacts
agent_action_drafts
agent_memory_items
agent_sources
agent_provider_runs
agent_feedback
```

Do not build redundant AI feature islands. Do not expand V2 `ai_*` tables. Use adapters and one `/api/ai/agent/run` command path.
