# Empire OS V3 Complex Reasoning Protocol

## Purpose

The V3 agent must solve hard problems, not just answer prompts. It needs a repeatable protocol for business, credit, finance, trading, politics/regulation, acquisitions, career, and execution decisions.

Do not expose hidden chain-of-thought. Store and show a concise **reasoning summary**, assumptions, evidence, options, risks, and decision log.

## Core Problem-Solving Loop

Use this loop for medium/high-stakes requests:

```txt
Frame -> Facts -> Unknowns -> Data Plan -> Analysis -> Options -> Risk Review -> Decision -> Action Drafts -> Feedback
```

## Problem Frame

For every complex task, create:

```ts
export type ProblemFrame = {
  domain: AgentDomain;
  objective: string;
  decisionToMake?: string;
  timeHorizon?: string;
  constraints: string[];
  knownFacts: string[];
  unknowns: string[];
  requiredData: string[];
  stakes: 'medium' | 'high';
  canAnswerNow: boolean;
  needsMemory: boolean;
  needsResearch: boolean;
};
```

## Analysis Artifact

The final response should be backed by an artifact:

```ts
export type ReasoningArtifact = {
  problemFrame: ProblemFrame;
  assumptions: string[];
  evidence: EvidenceItem[];
  calculations: CalculationSummary[];
  options: OptionAnalysis[];
  risks: RiskItem[];
  recommendation: string;
  confidence: number;
  whatWouldChangeMyMind: string[];
  actionDrafts: ActionDraftCandidate[];
};
```

## Domain Protocols

### Finance / Cash / Debt

Required thinking:

```txt
cash runway
monthly obligations
APR/cost of capital
liquidity priority
downside scenario
best next cash move
```

Return:

```txt
recommended move
cash impact
risk level
time sensitivity
next 3 actions
```

### Business Credit / Funding

Required thinking:

```txt
entity status
entity age
revenue/deposits
business bank relationship
personal credit/PG exposure
tradelines
documentation needed
lender sequence
fraud/misrepresentation boundary
```

Return:

```txt
funding readiness score
best lender/product path
what to fix first
documents needed
approval assumptions and risks
```

Never recommend misrepresentation, fake revenue, synthetic identity tactics, or credit washing fraud.

### Markets / Trading

Require fresh data for live/current market calls.

Required thinking:

```txt
thesis
time horizon
entry logic
invalidation level
max loss
position sizing logic
news/earnings/events
what would change the answer
```

Return:

```txt
research_needed if data is stale
risk framework
not a guaranteed trade call
what to check before acting
```

Never place trades or guarantee returns.

### Politics / Regulation

Require fresh sources for current claims.

Required thinking:

```txt
jurisdiction
stakeholders
policy/regulatory change
business impact
uncertainty
source quality
ethical boundary
```

Return:

```txt
impact analysis
what changed / what must be verified
business risk/opportunity
sources needed or used
```

Never generate deceptive persuasion or targeted voter manipulation.

### Acquisitions / Real Estate / Deals

Required thinking:

```txt
valuation
NOI/cap rate/cash flow
financing path
seller motivation
due diligence list
downside scenario
exit strategy
negotiation angle
```

Return:

```txt
go/no-go/needs-info
missing diligence
offer structure
risk controls
next actions
```

### Career / Income

Required thinking:

```txt
target comp
fit score
resume positioning
recruiter action
interview risk
time-to-cash
opportunity cost
```

Return:

```txt
best move today
message/draft if useful
follow-up action drafts
```

## Multi-Specialist Reasoning

For high-stakes tasks, use a council:

```txt
Domain Specialist
Finance/Numbers Specialist
Research Analyst if current facts are needed
Risk/Compliance Critic
Execution Operator
Final Judge
```

Each specialist returns:

```ts
export type SpecialistVote = {
  specialist: string;
  recommendation: string;
  reasoningSummary: string;
  confidence: number;
  risks: string[];
  missingData: string[];
  actionCandidates: ActionDraftCandidate[];
};
```

The Final Judge must reconcile disagreement and explicitly state:

```txt
best answer
why not the alternatives
key assumptions
risk warning
what information would change the answer
```

## Memory and Research Gates

The agent must know when it cannot responsibly answer without more data.

Return `memory_required` when a stable user fact is missing:

```txt
risk tolerance
capital available
entity/revenue status
credit profile
geography
business goals
relationship context
```

Return `research_required` when current facts are needed:

```txt
market prices/news/options
current lender terms
current legal/political/regulatory changes
current real estate comps/listings
current company facts
```

Ask at most two highest-leverage questions unless the user explicitly asks for a full intake.

## Output Standard

Default response format:

```txt
Recommendation
Why
Top actions
Risks
Missing memory/research
Approval drafts
```

Complex response can include expandable sections:

```txt
Problem frame
Evidence
Specialist votes
Calculations
Provider runs
Decision log
```

## Tests Required

Add tests proving:

```txt
complex finance request builds a problem frame
trading request without fresh data returns research_required
business credit request asks for missing entity/revenue/PG memory when absent
high-stakes acquisition request runs risk/compliance critic
low-stakes request does not run council
final response includes assumptions and what-would-change-my-mind
no hidden chain-of-thought is returned
```
