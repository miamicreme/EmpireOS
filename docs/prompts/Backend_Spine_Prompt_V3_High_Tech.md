# Empire OS — Backend Spine Prompt V3 High-Tech Edition

## Role

You are an elite principal software engineer, systems architect, AI product engineer, and security-minded backend developer.

You are building **Empire OS**, a private execution operating system for Kohron Burton’s KJB Empire plan.

This is not a generic productivity app.

Empire OS is a **spine-driven personal operating system** that ranks actions, tracks cash, organizes high-income job progress, manages follow-ups, supports acquisitions, and uses multiple AI advisors to help make better decisions.

Build the **backend spine first**.

Do **not** build frontend screens yet.

---

# 1. Framework Decision

This project uses:

- **Next.js App Router**
- **TypeScript**
- **Supabase Auth**
- **Supabase PostgreSQL**
- **Row Level Security**
- **Zod**
- **Server Actions / API Routes where appropriate**
- **Modular backend services**
- **AI-ready architecture**

Do not use Vite.

Do not use React Router.

Do not create frontend pages beyond minimal placeholders if Next.js requires them.

Do not build UI yet.

The backend should be ready for a future premium dashboard, mobile-first PWA, AI command center, and multi-module operating system.

---

# 2. Product Philosophy

Empire OS follows this rule:

```txt
The Spine owns priority.
Modules own detail.
Decisions create actions.
Actions move phases.
Phases build the empire.
```

The system should answer:

```txt
What matters today?
What creates cash?
What moves the high-income path forward?
What follow-ups are due?
What decisions need to be made?
What should be ignored?
What is the next best action?
```

---

# 3. Architecture

Empire OS uses a **Spine + Modules + AI Decision Layer** architecture.

## Spine

The Spine owns the shared operating system:

- Auth integration
- User profile
- Empire phases
- Module registry
- Global actions
- Global metrics
- Action ranking
- Empire Score
- Daily reviews
- Weekly reviews
- Decisions
- Multi-advisor AI votes
- Audit events
- System events
- Notifications foundation
- Shared contracts
- Shared validation
- Shared service patterns

## Modules

Modules own their business domains:

- Cash Engine
- High-Income Job Hunt
- Follow-Up CRM
- Credit / Funding
- Projects
- Acquisitions
- Future modules

Every module must plug into the Spine through:

- `global_actions`
- `module_metrics`
- `decisions`
- `audit_events`
- `system_events`

## AI Decision Layer

The AI layer should support multiple LLM/advisor roles:

- Cash Advisor
- Career Advisor
- Risk Advisor
- Deal Advisor
- Execution Advisor
- Final Judge

For V3, build the data structures, service interfaces, and route stubs only.

Do not hardcode real API keys.

Do not connect real LLM providers yet unless environment variables are present.

---

# 4. Required Branch

Work on:

```bash
feature/spine-backend-v3
```

If the branch does not exist, create it.

---

# 5. Required Folder Structure

Create or update this structure:

```txt
Empire-OS/
│
├── supabase/
│   ├── migrations/
│   │   └── 0001_spine_backend_v3.sql
│   ├── seed.sql
│   └── README.md
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts
│   │   │   ├── actions/
│   │   │   │   └── route.ts
│   │   │   ├── metrics/
│   │   │   │   └── route.ts
│   │   │   ├── decisions/
│   │   │   │   └── route.ts
│   │   │   ├── modules/
│   │   │   │   └── route.ts
│   │   │   └── sync/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── env.ts
│   │   ├── result.ts
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   ├── dates.ts
│   │   └── security.ts
│   │
│   ├── spine/
│   │   ├── types.ts
│   │   ├── schemas.ts
│   │   ├── constants.ts
│   │   ├── module-contract.ts
│   │   ├── module-registry.ts
│   │   ├── spine-orchestrator.service.ts
│   │   ├── empire-score.service.ts
│   │   ├── action-ranking.service.ts
│   │   │
│   │   ├── actions/
│   │   │   ├── action.types.ts
│   │   │   ├── action.schemas.ts
│   │   │   └── action.service.ts
│   │   │
│   │   ├── metrics/
│   │   │   ├── metric.types.ts
│   │   │   ├── metric.schemas.ts
│   │   │   └── metric.service.ts
│   │   │
│   │   ├── decisions/
│   │   │   ├── decision.types.ts
│   │   │   ├── decision.schemas.ts
│   │   │   ├── advisor.types.ts
│   │   │   ├── decision.service.ts
│   │   │   ├── decision-orchestrator.service.ts
│   │   │   └── context-redaction.service.ts
│   │   │
│   │   ├── reviews/
│   │   │   ├── review.types.ts
│   │   │   ├── review.schemas.ts
│   │   │   └── review.service.ts
│   │   │
│   │   ├── events/
│   │   │   ├── event.types.ts
│   │   │   ├── event.schemas.ts
│   │   │   └── event.service.ts
│   │   │
│   │   └── audit/
│   │       ├── audit.types.ts
│   │       ├── audit.schemas.ts
│   │       └── audit.service.ts
│   │
│   ├── modules/
│   │   ├── _template/
│   │   │   ├── manifest.ts
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts
│   │   │   ├── service.ts
│   │   │   ├── metrics.ts
│   │   │   ├── actions.ts
│   │   │   ├── decisions.ts
│   │   │   ├── events.ts
│   │   │   └── README.md
│   │   │
│   │   ├── cash-engine/
│   │   │   ├── manifest.ts
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts
│   │   │   ├── service.ts
│   │   │   ├── metrics.ts
│   │   │   ├── actions.ts
│   │   │   ├── decisions.ts
│   │   │   └── events.ts
│   │   │
│   │   ├── job-hunt/
│   │   │   ├── manifest.ts
│   │   │   ├── types.ts
│   │   │   ├── schemas.ts
│   │   │   ├── service.ts
│   │   │   ├── metrics.ts
│   │   │   ├── actions.ts
│   │   │   ├── decisions.ts
│   │   │   └── events.ts
│   │   │
│   │   └── followup-crm/
│   │       ├── manifest.ts
│   │       ├── types.ts
│   │       ├── schemas.ts
│   │       ├── service.ts
│   │       ├── metrics.ts
│   │       ├── actions.ts
│   │       ├── decisions.ts
│   │       └── events.ts
│   │
│   └── README_BACKEND.md
│
├── docs/
│   ├── SPINE_DESIGN.md
│   ├── MODULE_DESIGN.md
│   ├── DECISION_ENGINE_DESIGN.md
│   ├── SECURITY_MODEL.md
│   └── BACKEND_RUNBOOK.md
│
└── .env.example
```

---

# 6. Database Migration Requirements

Create:

```txt
supabase/migrations/0001_spine_backend_v3.sql
```

The migration must create these tables.

## Spine Tables

- `profiles`
- `empire_phases`
- `modules`
- `global_actions`
- `module_metrics`
- `decisions`
- `decision_options`
- `decision_votes`
- `daily_reviews`
- `weekly_reviews`
- `audit_events`
- `system_events`
- `notifications`
- `documents`

## Module Tables

- `cash_entries`
- `job_applications`
- `contacts`
- `projects`
- `credit_items`
- `acquisition_targets`

---

# 7. Database Standards

Use PostgreSQL/Supabase best practices:

- Enable `pgcrypto` if needed for `gen_random_uuid()`.
- Use `timestamptz`, not plain timestamp.
- Use `jsonb` for metadata.
- Add `created_at` and `updated_at` where useful.
- Add indexes for `user_id`, `module_id`, `status`, `due_at`, and date fields.
- Add check constraints for important status fields where practical.
- Add triggers to maintain `updated_at`.
- Add Row Level Security on every user-owned table.
- Public reference tables should be readable to authenticated users.
- User-owned data must never be visible across users.

---

# 8. Core Table Details

## profiles

```sql
id uuid primary key references auth.users(id) on delete cascade
full_name text
email text
current_phase text default 'phase_0'
daily_cash_target numeric default 250
weekly_cash_target numeric default 1500
monthly_cash_target numeric default 6000
risk_tolerance text default 'balanced'
primary_goal text default 'Build KJB Empire'
timezone text default 'America/New_York'
created_at timestamptz default now()
updated_at timestamptz default now()
```

## empire_phases

```sql
id text primary key
name text not null
description text
goal text
status text not null default 'pending'
priority_order int not null
progress numeric default 0
created_at timestamptz default now()
```

Seed:

```txt
phase_0 — Stabilize Cash
phase_1 — High-Income Role
phase_2 — Capital Stack
phase_3 — Acquire Cash Flow
phase_4 — Roll-Up
```

## modules

```sql
id text primary key
name text not null
slug text unique not null
description text
phase_id text references empire_phases(id)
status text not null default 'active'
priority int not null default 100
health text default 'yellow'
route text not null
icon text
capabilities jsonb default '[]'::jsonb
created_at timestamptz default now()
updated_at timestamptz default now()
```

Seed:

```txt
cash-engine
job-hunt
followup-crm
credit-funding
projects
acquisitions
```

## global_actions

Every module should create actions here.

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
module_id text references modules(id)
phase_id text references empire_phases(id)
title text not null
description text
category text not null
status text not null default 'open'
priority text not null default 'medium'
due_at timestamptz
completed_at timestamptz
impact_score int default 5
urgency_score int default 5
effort_score int default 5
confidence_score numeric default 0.5
empire_score_weight numeric default 1
rank_score numeric
source_type text default 'manual'
source_id text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
updated_at timestamptz default now()
```

Rank score should be calculated in the service layer:

```txt
rank_score = impact_score + urgency_score + confidence_score - effort_score
```

## module_metrics

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
module_id text references modules(id)
metric_key text not null
metric_label text not null
metric_value numeric
metric_text text
target_value numeric
unit text
date date default current_date
trend_direction text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
```

## decisions

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
title text not null
question text not null
context text
status text not null default 'draft'
recommendation text
confidence numeric
selected_option text
risk_level text
upside_level text
decision_type text default 'general'
created_at timestamptz default now()
decided_at timestamptz
metadata jsonb default '{}'::jsonb
```

## decision_options

```sql
id uuid primary key default gen_random_uuid()
decision_id uuid references decisions(id) on delete cascade
label text not null
description text
pros jsonb default '[]'::jsonb
cons jsonb default '[]'::jsonb
estimated_cash_impact numeric
estimated_time_hours numeric
estimated_risk text
metadata jsonb default '{}'::jsonb
```

## decision_votes

```sql
id uuid primary key default gen_random_uuid()
decision_id uuid references decisions(id) on delete cascade
advisor_name text not null
advisor_role text not null
model_name text
recommendation text not null
reasoning text
confidence numeric
risks text
next_actions jsonb default '[]'::jsonb
redactions_applied boolean default true
created_at timestamptz default now()
```

## audit_events

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete set null
event_type text not null
entity_type text not null
entity_id text
summary text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
```

## system_events

This is the high-tech event layer.

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
event_name text not null
event_type text not null
module_id text references modules(id)
entity_type text
entity_id text
payload jsonb default '{}'::jsonb
processed_at timestamptz
created_at timestamptz default now()
```

Use this for future automations like:

```txt
cash.entry.created
job.application.created
contact.followup.due
decision.finalized
action.completed
module.synced
```

## notifications

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
title text not null
body text
notification_type text not null default 'info'
status text not null default 'unread'
related_entity_type text
related_entity_id text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
read_at timestamptz
```

## documents

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
module_id text references modules(id)
title text not null
document_type text
storage_path text
summary text
sensitive boolean default false
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
updated_at timestamptz default now()
```

---

# 9. Module Table Details

## cash_entries

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
date date not null default current_date
source text not null
gross_amount numeric default 0
expenses numeric default 0
net_amount numeric generated always as (gross_amount - expenses) stored
hours numeric
trips int
notes text
created_at timestamptz default now()
updated_at timestamptz default now()
```

## job_applications

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
company text not null
role text not null
salary_min numeric
salary_max numeric
status text default 'saved'
priority_score int default 5
recruiter_name text
recruiter_email text
job_url text
resume_version text
next_action text
follow_up_at timestamptz
notes text
created_at timestamptz default now()
updated_at timestamptz default now()
```

## contacts

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
name text not null
company text
contact_type text not null
phone text
email text
status text default 'active'
last_contacted_at timestamptz
next_follow_up_at timestamptz
related_module_id text references modules(id)
notes text
created_at timestamptz default now()
updated_at timestamptz default now()
```

## projects

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
name text not null
status text default 'active'
focus_level text default 'medium'
revenue_potential numeric
strategic_value int default 5
next_action text
blocker text
notes text
created_at timestamptz default now()
updated_at timestamptz default now()
```

## credit_items

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
bureau text
item_name text not null
item_type text
status text default 'open'
due_at timestamptz
next_action text
notes text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
updated_at timestamptz default now()
```

## acquisition_targets

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade
name text not null
target_type text not null
location text
asking_price numeric
revenue numeric
noi numeric
seller_financing_possible boolean default false
status text default 'watching'
upside_score int default 5
risk_score int default 5
next_action text
notes text
metadata jsonb default '{}'::jsonb
created_at timestamptz default now()
updated_at timestamptz default now()
```

---

# 10. RLS Security Requirements

Enable RLS on all user-owned tables:

- profiles
- global_actions
- module_metrics
- decisions
- decision_options
- decision_votes
- daily_reviews
- weekly_reviews
- audit_events
- system_events
- notifications
- documents
- cash_entries
- job_applications
- contacts
- projects
- credit_items
- acquisition_targets

Rules:

- Users can only read their own rows.
- Users can only insert rows where `user_id = auth.uid()`.
- Users can only update their own rows.
- Users can only delete their own rows.
- `decision_options` and `decision_votes` must be protected through the parent `decisions.user_id`.
- `empire_phases` and `modules` are authenticated-readable reference tables.

Do not rely on frontend filtering.

---

# 11. TypeScript Requirements

Create strong types for:

- EmpirePhase
- EmpireModule
- ModuleManifest
- ModuleContract
- GlobalAction
- ModuleMetric
- Decision
- DecisionOption
- DecisionVote
- DailyReview
- WeeklyReview
- AuditEvent
- SystemEvent
- Notification
- DocumentRecord
- CashEntry
- JobApplication
- Contact
- Project
- CreditItem
- AcquisitionTarget

Create literal unions for:

- ModuleStatus
- ModuleHealth
- ActionStatus
- ActionPriority
- ActionCategory
- DecisionStatus
- DecisionType
- AdvisorRole
- ContactType
- JobStatus
- CashSource
- ProjectStatus
- CreditItemStatus
- AcquisitionStatus
- EventType
- NotificationStatus

Avoid `any`.

Use narrow types where practical.

---

# 12. Zod Requirements

Create Zod schemas for:

- create/update global action
- create/update module metric
- create/update decision
- create/update decision option
- create/update decision vote
- create/update daily review
- create/update weekly review
- create/update audit event
- create/update system event
- create/update notification
- create/update document
- create/update cash entry
- create/update job application
- create/update contact
- create/update project
- create/update credit item
- create/update acquisition target

Validation must happen before database writes.

---

# 13. Service Layer Requirements

Create clean service files with typed inputs and consistent results.

Use a shared `Result<T>` pattern:

```ts
export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
```

## Global Action Service

Functions:

- `createAction(input)`
- `updateAction(id, input)`
- `completeAction(id)`
- `getOpenActions(userId)`
- `getRankedActions(userId)`
- `getActionsByModule(userId, moduleId)`
- `recalculateActionRank(action)`

## Metric Service

Functions:

- `recordMetric(input)`
- `getTodayMetrics(userId)`
- `getMetricsByModule(userId, moduleId)`
- `getMetricTrend(userId, metricKey, days)`

## Decision Service

Functions:

- `createDecision(input)`
- `addDecisionOption(decisionId, input)`
- `addAdvisorVote(decisionId, input)`
- `getDecisionWithVotes(decisionId)`
- `finalizeDecision(decisionId, recommendation)`
- `createActionsFromDecision(decisionId)`

## Decision Orchestrator

Create service stubs for:

- `buildDecisionContext(userId, decisionId)`
- `redactSensitiveContext(context)`
- `runAdvisorPanel(decisionId)`
- `synthesizeFinalRecommendation(decisionId)`

No real LLM keys should be hardcoded.

## Spine Orchestrator

Functions:

- `syncAllModulesToSpine(userId)`
- `getCommandDashboardData(userId)`
- `getTodayTopActions(userId)`
- `getModuleHealthSummary(userId)`

## Empire Score Service

Calculate 0–100 using:

```txt
Cash progress: 30%
High-priority actions: 25%
Job hunt progress: 20%
Follow-ups: 15%
Daily review: 10%
```

Return:

```ts
type EmpireScoreResult = {
  score: number;
  grade: 'red' | 'yellow' | 'green';
  breakdown: {
    cash: number;
    actions: number;
    jobHunt: number;
    followUps: number;
    review: number;
  };
};
```

## Event Service

Functions:

- `emitSystemEvent(input)`
- `markEventProcessed(eventId)`
- `getUnprocessedEvents(userId)`

## Audit Service

Functions:

- `recordAuditEvent(input)`
- `getAuditTrail(userId, entityType, entityId)`

---

# 14. Module Contract V3

Create this shared contract:

```ts
export type DecisionContext = {
  moduleId: string;
  summary: string;
  facts: Record<string, unknown>;
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
};

export type ModuleHealthResult = {
  moduleId: string;
  health: 'green' | 'yellow' | 'red';
  reason: string;
};

export type ModuleContract = {
  manifest: ModuleManifest;

  getMetrics: (userId: string) => Promise<ModuleMetric[]>;

  getActions: (userId: string) => Promise<GlobalAction[]>;

  getDecisionContext: (userId: string) => Promise<DecisionContext>;

  getHealth: (userId: string) => Promise<ModuleHealthResult>;

  syncToSpine: (userId: string) => Promise<void>;
};
```

Create contracts for:

- Cash Engine
- Job Hunt
- Follow-Up CRM

Create a `_template` module that future modules can copy.

---

# 15. Module Registry V3

Create:

```txt
src/spine/module-registry.ts
```

It must export:

- `moduleRegistry`
- `getActiveModules()`
- `getModuleById(id)`
- `syncAllModulesToSpine(userId)`
- `getAllModuleMetrics(userId)`
- `getAllModuleActions(userId)`
- `getAllDecisionContexts(userId)`
- `getModuleHealthSummary(userId)`

---

# 16. API Route Stubs

Create minimal, secure route stubs.

Do not build UI.

## `/api/health`

Returns app health.

## `/api/actions`

Supports:

- GET ranked actions
- POST create action

## `/api/metrics`

Supports:

- GET today metrics
- POST record metric

## `/api/decisions`

Supports:

- GET decisions
- POST create decision

## `/api/modules`

Returns module registry metadata.

## `/api/sync`

Triggers module sync for authenticated user.

Routes should:

- Validate input with Zod.
- Use server Supabase client.
- Never expose secrets.
- Return typed JSON.
- Return proper HTTP statuses.

---

# 17. AI / LLM Safety Rules

Create `context-redaction.service.ts`.

Before sending context to any future external AI model, redact:

- SSNs
- Taxpayer IDs
- full account numbers
- full addresses when unnecessary
- medical details unless directly needed
- private emails unless needed
- phone numbers unless needed
- raw tax records
- bank account details

The redaction service should expose:

- `redactSensitiveText(text)`
- `redactDecisionContext(context)`
- `assertNoHighRiskSecrets(text)`

Use simple pattern-based redaction first.

---

# 18. Seed Data

Create `supabase/seed.sql` with:

- Empire phases
- Modules
- Example module metrics without private data
- Example global actions without private data
- Example advisor roles in comments or reference constants

Do not seed private personal records.

---

# 19. Documentation

Create docs:

## `docs/SPINE_DESIGN.md`

Explain:

- Spine responsibilities
- Global actions
- Metrics
- Empire Score
- Orchestration

## `docs/MODULE_DESIGN.md`

Explain:

- Module contract
- Module manifest
- How to create a new module
- How module data syncs to the Spine

## `docs/DECISION_ENGINE_DESIGN.md`

Explain:

- Decision records
- Options
- Advisor votes
- Final Judge
- Context redaction
- Future LLM providers

## `docs/SECURITY_MODEL.md`

Explain:

- RLS
- User isolation
- Sensitive data handling
- AI redaction
- Audit events

## `docs/BACKEND_RUNBOOK.md`

Explain:

- How to install dependencies
- How to run Supabase locally
- How to apply migrations
- How to seed
- How to run typecheck
- How to test services

---

# 20. Environment Variables

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

Do not create `.env.local` with real secrets.

Do not commit secrets.

---

# 21. Quality Bar

Before finishing, check:

1. SQL migration is valid PostgreSQL/Supabase SQL.
2. RLS policies are enabled and correct.
3. Reference tables are readable by authenticated users.
4. User-owned tables are isolated by `auth.uid()`.
5. TypeScript has no avoidable `any`.
6. Zod schemas match DB shape.
7. Service functions validate before writes.
8. API routes use typed responses.
9. No frontend screens are built.
10. No secrets are hardcoded.
11. Documentation explains how to extend the system.
12. Module contracts are reusable.
13. Event and audit layers are present.
14. Decision engine is ready for future LLM integration.

---

# 22. Final Output Expected

When finished, summarize:

- Files created
- Tables created
- RLS policies added
- Indexes added
- Services created
- Module contracts created
- API stubs created
- Docs created
- How to run migrations
- How to seed database
- What to build next

Recommended next branch after this:

```bash
feature/module-template-v3
```

Then:

```bash
feature/cash-engine-v3
feature/job-hunt-v3
feature/followup-crm-v3
feature/decision-engine-v3
feature/dashboard-ui-v3
```

---

# 23. Absolute Do Not Do List

Do not build frontend UI screens yet.

Do not use Vite.

Do not use React Router.

Do not create fake security.

Do not skip RLS.

Do not hardcode API keys.

Do not put private user data in seed files.

Do not make modules independent repos.

Do not let modules bypass the Spine.

Do not make decisions without logging them.

Do not send sensitive context to future LLMs without redaction.

---

# 24. Core North Star

Build Empire OS like a real high-leverage command system.

The backend must be strong enough that future modules can be added without rewriting the app.

The first version should feel like the foundation for a serious AI-powered personal operating system, not a todo app.
