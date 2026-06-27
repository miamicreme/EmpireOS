# Empire OS — Module Build Prompt V3 High-Tech

## Purpose

You are an expert senior software engineer, principal architect, product engineer, and AI systems designer.

We are building **Empire OS**, a private execution operating system using a **Spine + Modules** architecture.

The backend spine already defines the shared foundation:

- Auth
- Profiles
- Empire phases
- Module registry
- Global actions
- Module metrics
- Decisions
- Decision votes
- Empire Score
- Events
- Audit logs
- Notifications foundation
- AI decision orchestration foundation

Your job is to build the **Module System V3**.

Do **not** build random one-off modules.

Build a reusable, high-tech module architecture where every module follows the same standard and plugs into the Spine cleanly.

---

## Framework Decision

This project uses:

- Next.js App Router
- TypeScript
- Supabase
- PostgreSQL
- Row Level Security
- Zod
- Server-first architecture
- API routes only where needed
- Modular folder structure
- No Vite
- No React Router
- No untyped backend calls
- No private data sent to AI without redaction

---

# Core Principle

The Spine owns priority.

Modules own domain detail.

Every module must produce:

1. Metrics
2. Actions
3. Decision context
4. Events
5. Audit records
6. Health status
7. Optional notifications
8. Optional documents
9. Optional AI advisor context

A module is not just a page.

A module is a specialized operating unit inside Empire OS.

---

# Required Module Contract

Create or improve the shared module contract.

File:

```txt
src/spine/module-contract.ts
```

Every module must implement this:

```ts
export type ModuleId =
  | "cash-engine"
  | "job-hunt"
  | "followup-crm"
  | "credit-funding"
  | "projects"
  | "acquisitions"
  | string;

export type ModuleStatus =
  | "active"
  | "light_active"
  | "parked"
  | "later"
  | "disabled";

export type ModuleHealth =
  | "green"
  | "yellow"
  | "red"
  | "unknown";

export type ModuleCapability =
  | "metrics"
  | "actions"
  | "decisions"
  | "events"
  | "notifications"
  | "documents"
  | "ai_context"
  | "health_check"
  | "sync";

export type ModuleManifest = {
  id: ModuleId;
  name: string;
  slug: string;
  description: string;
  phaseId: string;
  status: ModuleStatus;
  priority: number;
  route: string;
  icon?: string;
  capabilities: ModuleCapability[];
  version: string;
  owner?: string;
};

export type ModuleMetric = {
  moduleId: ModuleId;
  key: string;
  label: string;
  value?: number;
  text?: string;
  target?: number;
  unit?: string;
  date?: string;
  metadata?: Record<string, unknown>;
};

export type ModuleAction = {
  moduleId: ModuleId;
  phaseId: string;
  title: string;
  description?: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  dueAt?: string;
  impactScore: number;
  urgencyScore: number;
  effortScore: number;
  empireScoreWeight?: number;
  metadata?: Record<string, unknown>;
};

export type DecisionContext = {
  moduleId: ModuleId;
  summary: string;
  facts: Array<{
    label: string;
    value: string | number | boolean | null;
    importance: "low" | "medium" | "high" | "critical";
  }>;
  risks: string[];
  opportunities: string[];
  recommendedQuestions: string[];
  redacted: boolean;
  metadata?: Record<string, unknown>;
};

export type ModuleHealthCheck = {
  moduleId: ModuleId;
  health: ModuleHealth;
  summary: string;
  issues: string[];
  lastSyncedAt?: string;
};

export type EmpireModule = {
  manifest: ModuleManifest;

  getMetrics: (userId: string) => Promise<ModuleMetric[]>;

  getActions: (userId: string) => Promise<ModuleAction[]>;

  getDecisionContext: (userId: string) => Promise<DecisionContext>;

  syncToSpine: (userId: string) => Promise<void>;

  healthCheck: (userId: string) => Promise<ModuleHealthCheck>;
};
```

---

# Module Folder Standard

Every module must follow this structure:

```txt
src/modules/<module-name>/
│
├── manifest.ts
├── types.ts
├── schemas.ts
├── service.ts
├── metrics.ts
├── actions.ts
├── decisions.ts
├── events.ts
├── health.ts
├── api.ts
├── README.md
│
├── components/
│   ├── <ModuleName>Card.tsx
│   ├── <ModuleName>Page.tsx
│   ├── <ModuleName>Form.tsx
│   ├── <ModuleName>List.tsx
│   └── <ModuleName>Detail.tsx
│
└── tests/
    ├── service.test.ts
    ├── metrics.test.ts
    ├── actions.test.ts
    └── decisions.test.ts
```

For backend-first work, create the structure and backend files first.

Frontend components can be stubs only unless specifically requested.

---

# Required Shared Module Template

Create a full reusable template module here:

```txt
src/modules/_template/
```

The template must include:

```txt
manifest.ts
types.ts
schemas.ts
service.ts
metrics.ts
actions.ts
decisions.ts
events.ts
health.ts
api.ts
README.md
```

The template should show exactly how a new module plugs into the Spine.

It should not contain random business logic.

It should contain clear TODO markers.

---

# Module Registry

Create or improve:

```txt
src/spine/module-registry.ts
```

It must:

- Import all module contracts
- Register active modules
- Provide lookup helpers
- Provide sync orchestration
- Provide metrics aggregation
- Provide actions aggregation
- Provide health checks
- Provide AI decision context aggregation

Required functions:

```ts
export function getAllModules(): EmpireModule[];

export function getActiveModules(): EmpireModule[];

export function getModuleById(moduleId: string): EmpireModule | null;

export async function syncAllModulesToSpine(userId: string): Promise<void>;

export async function getAllModuleMetrics(userId: string): Promise<ModuleMetric[]>;

export async function getAllModuleActions(userId: string): Promise<ModuleAction[]>;

export async function getAllDecisionContexts(userId: string): Promise<DecisionContext[]>;

export async function getModuleHealthReport(userId: string): Promise<ModuleHealthCheck[]>;
```

---

# Module Adapter Layer

Create a small adapter layer that converts module outputs into Spine database records.

File:

```txt
src/spine/module-adapter.ts
```

It should include:

```ts
export async function syncModuleMetricsToSpine(
  userId: string,
  moduleId: string,
  metrics: ModuleMetric[]
): Promise<void>;

export async function syncModuleActionsToSpine(
  userId: string,
  moduleId: string,
  actions: ModuleAction[]
): Promise<void>;

export async function recordModuleEvent(
  userId: string,
  moduleId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void>;
```

The adapter should write to:

- `module_metrics`
- `global_actions`
- `audit_events`
- `events` if the event table exists

Avoid duplicate actions where possible.

Use stable dedupe keys in metadata.

---

# Required Production Modules

Build or improve these initial modules:

1. Cash Engine
2. Job Hunt
3. Follow-Up CRM
4. Credit / Funding
5. Projects
6. Acquisitions

Do not overbuild all UI.

Backend services, metrics, actions, decisions, and health checks matter first.

---

# Module 1 — Cash Engine

Path:

```txt
src/modules/cash-engine/
```

Purpose:

Track income, expenses, daily cash target, weekly cash target, monthly cash target, and runway.

## Required Domain Table

Use or create:

```sql
cash_entries
```

Fields should include:

- id
- user_id
- date
- source
- gross_amount
- expenses
- net_amount
- hours
- trips
- notes
- created_at

## Required Types

Create:

```ts
export type CashSource =
  | "uber_eats"
  | "roadie"
  | "software_job"
  | "contract_work"
  | "real_estate"
  | "celebration_logistics"
  | "other";

export type CashEntry = {
  id: string;
  userId: string;
  date: string;
  source: CashSource;
  grossAmount: number;
  expenses: number;
  netAmount: number;
  hours?: number;
  trips?: number;
  notes?: string;
  createdAt: string;
};
```

## Required Service Functions

```ts
createCashEntry(input)
updateCashEntry(id, input)
deleteCashEntry(id)
getCashEntryById(id)
getTodayCash(userId)
getWeeklyCash(userId)
getMonthlyCash(userId)
getCashBySource(userId, startDate, endDate)
calculateCashGap(userId)
syncCashMetrics(userId)
createCashGapAction(userId)
```

## Required Metrics

Cash Engine must report:

- `today_cash`
- `today_cash_target`
- `today_cash_gap`
- `weekly_cash`
- `monthly_cash`
- `average_hourly_rate`
- `average_per_trip`
- `runway_days` if bill data exists, otherwise return `unknown`

## Required Actions

Cash Engine must generate actions like:

- Log today’s income
- Earn remaining daily cash gap
- Review expenses
- Check weekly cash target
- End day cash review

## Required Decision Context

Cash Engine must answer decision questions like:

- Do I need to prioritize cash today?
- Can I afford to spend money on this?
- Should I Uber today or work on long-term tasks?
- What is the cash gap?

The decision context must include:

- today cash
- daily target
- cash gap
- weekly cash
- urgent cash risk
- recommendation summary

---

# Module 2 — Job Hunt

Path:

```txt
src/modules/job-hunt/
```

Purpose:

Land a high-income software, AI, data, or architecture role.

## Required Domain Table

Use or create:

```sql
job_applications
```

## Required Types

```ts
export type JobStatus =
  | "saved"
  | "applied"
  | "followed_up"
  | "recruiter_screen"
  | "interview"
  | "final_round"
  | "offer"
  | "rejected"
  | "dead";

export type JobApplication = {
  id: string;
  userId: string;
  company: string;
  role: string;
  salaryMin?: number;
  salaryMax?: number;
  status: JobStatus;
  priorityScore: number;
  recruiterName?: string;
  recruiterEmail?: string;
  jobUrl?: string;
  resumeVersion?: string;
  nextAction?: string;
  followUpAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Required Service Functions

```ts
createJobApplication(input)
updateJobApplication(id, input)
deleteJobApplication(id)
getJobApplicationById(id)
getActiveJobApplications(userId)
getApplicationsByStatus(userId, status)
getFollowUpsDue(userId)
getHighValueOpportunities(userId)
calculatePipelineValue(userId)
syncJobMetrics(userId)
createJobFollowUpActions(userId)
```

## Required Metrics

Job Hunt must report:

- `applications_today`
- `applications_this_week`
- `followups_due`
- `interviews_active`
- `pipeline_value_low`
- `pipeline_value_high`
- `highest_priority_job`
- `offer_probability_estimate`

## Required Actions

Job Hunt must generate actions like:

- Apply to high-value role
- Follow up with recruiter
- Prepare interview notes
- Update resume
- Send proposal
- Record Loom demo
- Review job pipeline

## Required Decision Context

Job Hunt must support decisions like:

- Should I take this role?
- Employee or contract?
- Should I prioritize job applications over delivery work?
- Which role has the highest upside?
- What is my strongest next career move?

---

# Module 3 — Follow-Up CRM

Path:

```txt
src/modules/followup-crm/
```

Purpose:

Manage contacts, follow-ups, buyers, brokers, recruiters, lenders, investors, and business relationships.

## Required Domain Table

Use or create:

```sql
contacts
```

## Required Types

```ts
export type ContactType =
  | "buyer"
  | "seller"
  | "broker"
  | "recruiter"
  | "lender"
  | "investor"
  | "client"
  | "partner"
  | "other";

export type ContactStatus =
  | "active"
  | "warm"
  | "hot"
  | "cold"
  | "dead"
  | "do_not_contact";

export type Contact = {
  id: string;
  userId: string;
  name: string;
  company?: string;
  contactType: ContactType;
  phone?: string;
  email?: string;
  status: ContactStatus;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  relatedModuleId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Required Service Functions

```ts
createContact(input)
updateContact(id, input)
deleteContact(id)
getContactById(id)
getContactsByType(userId, contactType)
getFollowUpsDue(userId)
getOverdueFollowUps(userId)
markContacted(contactId, contactedAt)
createFollowUpAction(contactId)
syncFollowUpMetrics(userId)
```

## Required Metrics

Follow-Up CRM must report:

- `followups_due_today`
- `overdue_followups`
- `hot_contacts`
- `warm_contacts`
- `contacts_added_this_week`
- `response_rate` if tracked, otherwise unknown

## Required Actions

Follow-Up CRM must generate:

- Send follow-up text
- Send follow-up email
- Call contact
- Update contact status
- Schedule next follow-up
- Re-engage cold contact

## Required Decision Context

Follow-Up CRM must support:

- Who should I follow up with today?
- Which contact is most valuable?
- Which deal/contact is going cold?
- Should I reach out again or move on?

---

# Module 4 — Credit / Funding

Path:

```txt
src/modules/credit-funding/
```

Purpose:

Track credit profile, disputes, business banking, ChexSystems, Early Warning, LexisNexis, funding readiness, and lender prep.

## Required Domain Tables

Create if missing:

```sql
credit_snapshots
funding_tasks
funding_documents
```

## Suggested Fields

### `credit_snapshots`

- id
- user_id
- snapshot_date
- experian_score
- equifax_score
- transunion_score
- utilization_percent
- open_disputes
- chex_status
- early_warning_status
- lexisnexis_status
- notes
- created_at

### `funding_tasks`

- id
- user_id
- title
- category
- status
- due_at
- completed_at
- notes
- metadata
- created_at
- updated_at

### `funding_documents`

- id
- user_id
- document_type
- label
- storage_path
- status
- notes
- metadata
- created_at

## Required Metrics

Credit / Funding must report:

- `funding_readiness_score`
- `experian_score`
- `equifax_score`
- `transunion_score`
- `utilization_percent`
- `open_disputes`
- `banking_file_status`
- `documents_ready_count`
- `funding_blockers_count`

## Required Actions

Credit / Funding must generate:

- Mail dispute
- Check bureau response
- Update address
- Upload document
- Apply for card
- Review funding readiness
- Resolve banking file issue

## Required Decision Context

Credit / Funding must support:

- Am I fundable yet?
- What is the next credit move?
- Should I apply for this card/loan?
- What is blocking funding?
- Should I use cash for credit cleanup?

---

# Module 5 — Projects

Path:

```txt
src/modules/projects/
```

Purpose:

Rank and manage business projects so attention does not scatter.

## Required Domain Table

Create if missing:

```sql
projects
```

Fields:

- id
- user_id
- name
- description
- status
- focus_level
- revenue_potential
- strategic_value
- time_required
- risk_level
- next_action
- blocker
- notes
- created_at
- updated_at

## Required Metrics

Projects must report:

- `active_projects`
- `parked_projects`
- `blocked_projects`
- `highest_focus_project`
- `highest_upside_project`
- `distraction_risk_score`

## Required Actions

Projects must generate:

- Move project forward
- Park project
- Define next action
- Remove distraction
- Review project ranking
- Ship MVP step

## Required Decision Context

Projects must support:

- Which project should I focus on?
- Is this project a distraction?
- Should I park this idea?
- Which project creates income fastest?
- Which project supports the empire plan best?

---

# Module 6 — Acquisitions

Path:

```txt
src/modules/acquisitions/
```

Purpose:

Track property management companies, real estate deals, business acquisitions, LOIs, seller financing, target scoring, and upside.

## Required Domain Tables

Create if missing:

```sql
acquisition_targets
acquisition_contacts
acquisition_scores
```

## Suggested Fields

### `acquisition_targets`

- id
- user_id
- name
- target_type
- location
- asking_price
- revenue
- noi
- ebitda
- doors_count
- seller_financing_possible
- status
- next_action
- notes
- metadata
- created_at
- updated_at

### `acquisition_scores`

- id
- user_id
- target_id
- cash_flow_score
- seller_motivation_score
- financing_score
- upside_score
- risk_score
- overall_score
- notes
- created_at

## Required Metrics

Acquisitions must report:

- `active_targets`
- `targets_reviewed_this_week`
- `seller_financing_targets`
- `highest_score_target`
- `average_target_score`
- `estimated_noi_pipeline`

## Required Actions

Acquisitions must generate:

- Analyze target
- Contact owner
- Request financials
- Score acquisition
- Prepare LOI
- Follow up with seller
- Review financing options

## Required Decision Context

Acquisitions must support:

- Should I pursue this acquisition?
- Is this target worth time?
- Is seller financing likely?
- What is the upside?
- What is the risk?
- What is the next deal action?

---

# Event System Integration

Every module should emit events for important changes.

Examples:

```txt
cash.entry.created
cash.target.missed
job.application.created
job.followup.due
crm.contact.created
crm.followup.overdue
credit.snapshot.created
project.parked
acquisition.target.scored
```

Create module event helpers in each module:

```ts
emitCashEvent(...)
emitJobEvent(...)
emitCrmEvent(...)
```

These should call the shared Spine event/audit adapter.

---

# AI Context Redaction

Before sending module data to AI decision advisors, redact sensitive fields.

Never send:

- SSNs
- full account numbers
- tax IDs
- full credit report details
- full bank account numbers
- private document URLs
- exact addresses unless necessary
- sensitive medical details unless the user explicitly requests it

Create:

```txt
src/spine/ai/redaction.ts
```

Required functions:

```ts
redactDecisionContext(context)
redactText(input)
redactObject(input)
```

Use redacted context in all module `getDecisionContext()` outputs.

---

# Module Health Checks

Each module must include:

```txt
health.ts
```

Health should evaluate:

- Is the module active?
- Is there recent data?
- Are there overdue actions?
- Are key metrics missing?
- Is sync working?
- Are there blockers?

Return:

```ts
{
  moduleId,
  health,
  summary,
  issues,
  lastSyncedAt
}
```

Examples:

- Cash Engine red if no income logged today and cash target not met.
- Job Hunt yellow if no applications this week.
- Follow-Up CRM red if overdue follow-ups exist.
- Credit Funding yellow if no snapshot exists.
- Projects red if too many active projects.
- Acquisitions yellow if no targets reviewed this week.

---

# Module API Route Stubs

Use Next.js App Router API route conventions.

Create route stubs only where useful.

Examples:

```txt
src/app/api/modules/sync/route.ts
src/app/api/modules/health/route.ts
src/app/api/modules/metrics/route.ts
src/app/api/modules/actions/route.ts
```

These route stubs should:

- Get the authenticated user
- Call the module registry
- Return normalized data
- Not expose data across users

---

# Testing Requirements

Create lightweight tests or test-ready structure for:

- Module contract validation
- Metric generation
- Action generation
- Decision context redaction
- Health check result
- Service function validation

Use whatever testing setup already exists.

If no testing setup exists, create a minimal test plan in documentation instead of adding unnecessary dependencies.

---

# Documentation Requirements

Create:

```txt
src/modules/README.md
src/modules/_template/README.md
src/modules/cash-engine/README.md
src/modules/job-hunt/README.md
src/modules/followup-crm/README.md
src/modules/credit-funding/README.md
src/modules/projects/README.md
src/modules/acquisitions/README.md
```

Each module README must include:

- Purpose
- Spine connections
- Tables used
- Metrics produced
- Actions produced
- Decision context produced
- Events emitted
- Health rules
- How to extend it

---

# Quality Bar

Build this like a real product foundation.

Do:

- Use strong TypeScript types
- Use Zod validation
- Use Supabase safely
- Use user_id for all user-owned rows
- Use RLS-compatible patterns
- Keep module outputs normalized
- Avoid duplicate code where a shared helper makes sense
- Avoid overengineering
- Keep it readable
- Keep it extensible

Do not:

- Build random UI before backend module structure is stable
- Create module-specific hacks
- Send private data to AI unredacted
- Skip module manifests
- Skip module health checks
- Skip metrics/actions/decision context
- Use Vite
- Use React Router
- Hardcode another user’s data
- Put API secrets in code

---

# Final Expected Output

When finished, summarize:

1. Module architecture files created
2. Module template created
3. Modules implemented or scaffolded
4. Module registry updates
5. Module adapter updates
6. Metrics each module produces
7. Actions each module produces
8. Decision context each module produces
9. Health checks added
10. API route stubs added
11. Documentation added
12. Next recommended branch

Recommended branch:

```bash
git checkout -b feature/module-system-v3
```

---

# Recommended Build Order

Build in this order:

1. Shared module contract
2. Module adapter
3. Module registry
4. `_template` module
5. Cash Engine
6. Job Hunt
7. Follow-Up CRM
8. Credit / Funding
9. Projects
10. Acquisitions
11. AI redaction utilities
12. Module health route
13. Module sync route
14. Documentation
15. Validation / test plan

The final result should make it easy to add any future Empire OS module by copying `_template`, filling in domain logic, and plugging it into the registry.
