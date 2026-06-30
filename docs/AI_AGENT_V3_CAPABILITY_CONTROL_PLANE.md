# Empire OS V3 Capability Control Plane

## Purpose

The V3 agent needs the controls to get information, use available data, reason through complex problems, and draft actions. Those controls must be explicit, permissioned, auditable, and safe.

This document defines the **Capability Control Plane**.

## Core Principle

```txt
The agent may plan broadly.
The agent may gather approved internal data.
The agent may request access to missing data.
The agent may draft actions.
The agent may not secretly execute external, financial, destructive, or irreversible actions.
```

## Capability Categories

Create a registry of capabilities. A capability is anything the agent can use to gather data, transform information, or propose an action.

```ts
export type AgentCapabilityKind =
  | 'internal_read'
  | 'internal_write_draft'
  | 'internal_write_approved'
  | 'external_research'
  | 'external_action_draft'
  | 'external_action_approved'
  | 'calculation'
  | 'document_analysis'
  | 'provider_call'
  | 'memory_read'
  | 'memory_write_draft';
```

## Required Capability Registry

Create:

```txt
src/spine/ai/agent/capability-registry.service.ts
src/spine/ai/agent/capability-planner.service.ts
src/spine/ai/agent/capability-executor.service.ts
src/spine/ai/agent/permission-policy.service.ts
```

The registry should define capabilities such as:

```txt
read_spine_actions
read_module_metrics
read_cash_context
read_job_hunt_context
read_followup_context
read_credit_funding_context
read_projects_context
read_acquisitions_context
read_decision_history
read_ai_memory
request_memory_save
request_research
run_calculation
run_specialist_panel
call_provider
create_action_draft
approve_action_draft
create_research_request
create_memory_request
```

Future optional capabilities can be registered but must default to disabled until implemented:

```txt
web_research_adapter
file_document_analysis
calendar_read
email_draft
gmail_read
github_read
finance_account_read
stock_market_data_read
real_estate_comps_read
credit_bureau_data_manual_upload
```

Do not fake unsupported tools. If a capability is unavailable, return `access_needed` or `research_needed`.

## Permission Levels

Every capability must declare one permission level:

```txt
safe_auto          -> read-only internal data or calculations
approval_required -> writes, messages, external actions, money/legal/trade/funding moves
blocked           -> unsafe, unsupported, or illegal action
```

Examples:

```txt
read_spine_actions -> safe_auto
create_action_draft -> safe_auto
approve_action_draft -> approval_required
send_email -> approval_required and only if connector exists
place_trade -> blocked
submit_credit_application -> approval_required/manual only
delete_user_data -> approval_required/high-risk or blocked by default
```

## Capability Plan

Every agent run should create a plan before using tools:

```ts
export type CapabilityPlan = {
  runId: string;
  intent: AgentIntent;
  neededCapabilities: CapabilityRequest[];
  approvedCapabilities: CapabilityRequest[];
  blockedCapabilities: CapabilityRequest[];
  missingAccess: AccessRequest[];
  reason: string;
};
```

The plan should be logged and visible in the UI for deep/high-stakes runs.

## Data Access Ladder

When the agent needs information, it should use this order:

```txt
1. Existing structured app data
2. Saved memory
3. Recent context snapshots
4. User-provided files/text
5. Current research request / adapter
6. Ask one or two targeted questions
7. Continue with explicit assumptions only when safe
```

## Access Needed State

If a task requires data the app cannot currently access, return:

```ts
export type AccessNeeded = {
  capability: string;
  reason: string;
  valueIfConnected: string;
  safeAlternative: string;
  userActionRequired: string;
};
```

Examples:

```txt
To analyze live stock setup, I need current price/news/options data.
To score business credit readiness, I need entity age, revenue, banking, tradelines, and PG tolerance.
To analyze cash flow from real accounts, I need connected financial data or a manual upload.
```

## Tool Execution Rules

The executor must enforce:

```txt
Zod input validation
permission policy check
redaction before provider/external calls
rate/cost budget check
audit event before and after capability use
timeout/fallback for providers/research
no raw secrets in logs
no external/irreversible execution without approval
```

## Complex Problem Controls

For complex requests, the agent should be able to create a temporary problem workspace:

```txt
agent_problem_workspaces
agent_problem_models
agent_source_evaluations
agent_calculations
agent_option_scores
```

If not adding all tables immediately, implement typed in-memory objects and persist at least the run log, final synthesis, action drafts, memory requests, and research requests.

## Capability UI

Add or update UI components:

```txt
AgentControlPanel       -> show memory/research/access requests
CapabilityPlanPanel     -> show what the agent plans to use
AccessNeededCard        -> ask user to connect/upload/provide missing data
SourceQualityPanel      -> show current research/source requirements
ApprovalRequiredBanner  -> explain actions that need explicit approval
```

## Acceptance Gate

Capability control is complete only if tests prove:

```txt
unsupported tools return access_needed, not fake results
external actions become drafts, not live actions
high-risk tasks require approval
blocked capabilities cannot run
capability plans are logged
safe internal read capabilities can run automatically
provider keys and secrets never return to client
```
