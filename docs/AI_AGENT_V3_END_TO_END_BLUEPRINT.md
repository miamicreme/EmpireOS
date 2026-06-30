# Empire OS V3 — End-to-End Agent Blueprint

This document defines how the V3 agent works together as one system.

## Principle

One user command should produce one traceable agent run.

The run may create artifacts, memory requests, research requests, provider calls, specialist votes, and action drafts, but all of them belong to the same run.

## Example Command

```txt
Find the fastest path to cash this week without hurting the job hunt or credit plan.
```

## Expected Internal Flow

```txt
1. Create or load agent_session
2. Create agent_turn for user command
3. Create agent_run with status='running'
4. Intent Router labels intent: cash_strategy + career_constraint + credit_constraint
5. Capability Planner requests:
   - read_internal_data
   - build_context_pack
   - run_standard_reasoning
   - draft_spine_actions
6. Permission Policy approves safe reads and drafts
7. Context Pack Builder collects:
   - cash engine
   - open global actions
   - job hunt status
   - credit/funding status
   - projects
   - recent reviews
   - relevant memory
8. Memory Gate checks if cash target/risk tolerance is known
9. Research Gate decides if current external facts are needed
10. Provider Router selects model path
11. Specialist Council runs only needed specialists:
    - finance_cfo
    - career_income
    - risk_compliance
    - execution_operator
12. Final Synthesizer produces final answer
13. Agent creates agent_artifact
14. Agent creates pending agent_action_drafts
15. Agent returns concise answer + action approval controls
16. Agent logs provider runs, specialist votes, steps, and feedback options
```

## Run State Machine

```txt
queued
-> planning
-> context_building
-> memory_check
-> research_check
-> reasoning
-> synthesis
-> drafting
-> complete
```

Failure states:

```txt
blocked_memory_required
blocked_research_required
blocked_approval_required
failed
cancelled
```

## Agent Response Contract

Every `POST /api/ai/agent/run` response should return:

```ts
type AgentRunResponse = {
  runId: string;
  sessionId: string;
  turnId: string;
  runtimeMode: 'fast_path' | 'standard_path' | 'deep_path' | 'research_required' | 'memory_required' | 'approval_required';
  status: string;
  answer: string;
  confidence: number;
  reasoningSummary: string;
  risks: string[];
  opportunities: string[];
  nextActions: Array<{
    title: string;
    priority: string;
    reason: string;
  }>;
  actionDrafts: Array<{
    id: string;
    title: string;
    priority: string;
    approvalStatus: string;
  }>;
  memoryRequests: Array<{
    id: string;
    question: string;
    reason: string;
  }>;
  researchRequests: Array<{
    id: string;
    topic: string;
    reason: string;
  }>;
  providerSummary: {
    providersUsed: string[];
    fallbackUsed: boolean;
    estimatedCost?: number;
    latencyMs?: number;
  };
  specialistVotes?: Array<{
    role: string;
    recommendation: string;
    confidence: number;
  }>;
};
```

Do not return hidden chain-of-thought. Return a useful reasoning summary.

## API Surface

Primary endpoint:

```txt
POST /api/ai/agent/run
```

Supporting endpoints:

```txt
GET  /api/ai/agent/sessions
POST /api/ai/agent/sessions
GET  /api/ai/agent/sessions/:id
GET  /api/ai/agent/sessions/:id/turns
GET  /api/ai/memory
POST /api/ai/memory
PATCH /api/ai/memory/:id
GET  /api/ai/research/requests
POST /api/ai/research/requests
PATCH /api/ai/research/requests/:id
POST /api/ai/research/requests/:id/complete
POST /api/ai/action-drafts/:id/approve
```

Existing V2 endpoints may call the same underlying services.

## UI Contract

Primary UI:

```txt
/app/ai/agent
```

Required UI sections:

```txt
Agent Command Bar
Quick Actions
Answer Panel
Reasoning Summary
Context Used
Memory Needed
Research Needed
Specialist Votes
Provider Confidence
Action Draft Approval Bar
Session Timeline
```

The UI should make the agent feel like one operator, not separate tools.

## Low-Typing Commands

Add quick actions:

```txt
What should I do today?
Find cash fastest.
Rank my top actions.
What am I ignoring?
Draft next actions.
Analyze this deal.
Analyze this funding move.
Check my job hunt.
What needs follow-up?
Run deep strategy.
```

## Complex Problem Protocol

For complex problems, the agent must frame the problem first:

```txt
objective
constraints
data available
data missing
stake level
runtime mode
specialists needed
research needed
memory needed
decision deadline
```

Then reason through scenarios:

```txt
base case
upside case
downside case
cash impact
risk impact
time impact
next action
```

## What Makes It Feel Intelligent

The agent should proactively say:

```txt
I can answer this from your internal data.
I need current research before giving a confident answer.
I need one memory item to make this useful.
This is high-stakes, so I am routing it through risk/compliance and finance.
I drafted three actions; approve the ones you want added to the Spine.
```

## What It Must Not Do

```txt
Do not pretend current facts are known without research.
Do not run deep council for every small command.
Do not create real actions without approval.
Do not store sensitive secrets as memory.
Do not expose provider keys.
Do not bypass auth/RLS.
Do not create separate unconnected AI mini-features.
```
