# CLAUDE_BUILD_INSTRUCTIONS.md

# Empire OS — Complete Claude Build Instructions

## Role

You are Claude Code acting as a principal software engineer, senior product architect, backend engineer, frontend engineer, AI systems engineer, and security-minded technical lead.

You are building **Empire OS** inside the existing GitHub repo:

```txt
Empire-OS
```

This project is a private execution operating system using a **Spine + Modules + AI Decision Engine** architecture.

Build it like a real product foundation, not a toy demo.

---

# 0. Non-Negotiable Rules

## Framework Rules

Use:

```txt
Next.js App Router
TypeScript
Supabase
PostgreSQL
Row Level Security
Zod
Tailwind CSS
Server-first architecture
Vercel-ready structure
```

Do not use:

```txt
Vite
React Router
Pages Router
Untyped service calls
Random one-off folder patterns
Unredacted AI context
Hardcoded private user data
Secrets in code
Separate repos for modules
```

## Product Rules

Empire OS is not a generic planner.

It is a personal operating system that forces execution around:

```txt
Cash today
High-income job progress
Follow-ups
Credit/funding readiness
Business projects
Acquisitions
AI-assisted decisions
Daily and weekly accountability
```

The core rule:

```txt
The Spine owns priority.
Modules own detail.
Decisions create actions.
Actions move phases.
Phases build the empire.
```

---

# 1. Expected Repo Target

When finished, the repo should have this high-level shape:

```txt
Empire-OS/
│
├── CLAUDE_BUILD_INSTRUCTIONS.md
├── README.md
├── README_BACKEND.md
├── MASTER_GUIDE.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── middleware.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SPINE_DESIGN.md
│   ├── MODULE_DESIGN.md
│   ├── DECISION_ENGINE.md
│   ├── SECURITY.md
│   ├── RUNBOOK.md
│   ├── BRANCHING.md
│   └── VALIDATION.md
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_spine_backend.sql
│   │   └── 0002_module_tables.sql
│   ├── seed.sql
│   └── README.md
│
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── actions/route.ts
    │   │   ├── metrics/route.ts
    │   │   ├── modules/
    │   │   │   ├── sync/route.ts
    │   │   │   ├── health/route.ts
    │   │   │   ├── metrics/route.ts
    │   │   │   └── actions/route.ts
    │   │   ├── decisions/route.ts
    │   │   ├── empire-score/route.ts
    │   │   └── reviews/route.ts
    │   │
    │   ├── dashboard/page.tsx
    │   ├── actions/page.tsx
    │   ├── decisions/page.tsx
    │   ├── modules/
    │   │   ├── cash/page.tsx
    │   │   ├── jobs/page.tsx
    │   │   ├── followups/page.tsx
    │   │   ├── credit/page.tsx
    │   │   ├── projects/page.tsx
    │   │   └── acquisitions/page.tsx
    │   ├── layout.tsx
    │   └── page.tsx
    │
    ├── components/
    │   ├── layout/
    │   ├── ui/
    │   └── dashboard/
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts
    │   │   ├── server.ts
    │   │   └── middleware.ts
    │   ├── db.ts
    │   ├── env.ts
    │   ├── result.ts
    │   └── dates.ts
    │
    ├── spine/
    │   ├── types.ts
    │   ├── schemas.ts
    │   ├── module-contract.ts
    │   ├── module-registry.ts
    │   ├── module-adapter.ts
    │   ├── empire-score.service.ts
    │   ├── action-ranking.service.ts
    │   │
    │   ├── actions/
    │   │   ├── action.types.ts
    │   │   ├── action.schemas.ts
    │   │   └── action.service.ts
    │   │
    │   ├── metrics/
    │   │   ├── metric.types.ts
    │   │   ├── metric.schemas.ts
    │   │   └── metric.service.ts
    │   │
    │   ├── decisions/
    │   │   ├── decision.types.ts
    │   │   ├── decision.schemas.ts
    │   │   ├── advisor.types.ts
    │   │   ├── decision.service.ts
    │   │   ├── decision-orchestrator.ts
    │   │   └── local-advisors.ts
    │   │
    │   ├── ai/
    │   │   ├── redaction.ts
    │   │   └── providers.ts
    │   │
    │   ├── events/
    │   │   ├── event.types.ts
    │   │   ├── event.schemas.ts
    │   │   └── event.service.ts
    │   │
    │   └── reviews/
    │       ├── review.types.ts
    │       ├── review.schemas.ts
    │       └── review.service.ts
    │
    └── modules/
        ├── README.md
        ├── _template/
        ├── cash-engine/
        ├── job-hunt/
        ├── followup-crm/
        ├── credit-funding/
        ├── projects/
        └── acquisitions/
```

---

# 2. Build Strategy

Build in this order:

```txt
1. Project setup and environment structure
2. Supabase backend spine migration
3. Supabase module tables migration
4. Seed data
5. RLS policies
6. Shared TypeScript types
7. Shared Zod schemas
8. Spine services
9. Module contract and registry
10. Module adapter
11. Initial module backend logic
12. AI redaction utilities
13. Decision engine
14. API route stubs
15. Basic UI shell
16. Dashboard
17. Module UI pages
18. Documentation
19. Validation
```

Do not skip backend security.

Do not build UI before the backend spine and module contract exist.

---

# 3. Environment Setup

If the repo is empty, create a Next.js app using App Router.

Use:

```bash
npx create-next-app@latest .
```

Recommended options:

```txt
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src/ directory: Yes
App Router: Yes
Turbopack: Yes
Import alias: Yes
Alias: @/*
```

Install required packages:

```bash
npm install @supabase/supabase-js @supabase/ssr zod date-fns lucide-react recharts
npm install -D supabase
```

Create `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

Do not create `.env.local` with real secrets.

---

# 4. Supabase Backend Spine

Create:

```txt
supabase/migrations/0001_spine_backend.sql
```

It must create:

```txt
profiles
empire_phases
modules
global_actions
module_metrics
decisions
decision_options
decision_votes
daily_reviews
weekly_reviews
audit_events
events
notifications
documents
```

## 4.1 Required Extensions

Include:

```sql
create extension if not exists "pgcrypto";
```

## 4.2 Profiles

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  current_phase text default 'phase_0',
  daily_cash_target numeric default 250,
  weekly_cash_target numeric default 1500,
  monthly_cash_target numeric default 6000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 4.3 Empire Phases

```sql
create table if not exists empire_phases (
  id text primary key,
  name text not null,
  description text,
  goal text,
  status text not null default 'pending',
  priority_order int not null,
  progress numeric default 0,
  created_at timestamptz default now()
);
```

## 4.4 Modules

```sql
create table if not exists modules (
  id text primary key,
  name text not null,
  slug text unique not null,
  description text,
  phase_id text references empire_phases(id),
  status text not null default 'active',
  priority int not null default 100,
  health text default 'unknown',
  route text not null,
  icon text,
  capabilities jsonb default '[]'::jsonb,
  version text default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 4.5 Global Actions

```sql
create table if not exists global_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references modules(id),
  phase_id text references empire_phases(id),
  title text not null,
  description text,
  category text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  impact_score int default 5,
  urgency_score int default 5,
  effort_score int default 5,
  empire_score_weight numeric default 1,
  rank_score numeric,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 4.6 Module Metrics

```sql
create table if not exists module_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references modules(id),
  metric_key text not null,
  metric_label text not null,
  metric_value numeric,
  metric_text text,
  target_value numeric,
  unit text,
  date date default current_date,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## 4.7 Decisions

```sql
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  question text not null,
  context text,
  status text not null default 'draft',
  recommendation text,
  confidence numeric,
  selected_option text,
  risk_level text,
  upside_level text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  metadata jsonb default '{}'::jsonb
);
```

## 4.8 Decision Options

```sql
create table if not exists decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  label text not null,
  description text,
  pros jsonb default '[]'::jsonb,
  cons jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb
);
```

## 4.9 Decision Votes

```sql
create table if not exists decision_votes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id) on delete cascade,
  advisor_name text not null,
  advisor_role text not null,
  model_name text,
  recommendation text not null,
  reasoning text,
  confidence numeric,
  risks text,
  next_actions jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
```

## 4.10 Daily Reviews

```sql
create table if not exists daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null default current_date,
  cash_collected numeric default 0,
  actions_completed int default 0,
  empire_score numeric default 0,
  biggest_win text,
  biggest_leak text,
  what_moved_empire text,
  top_priority_tomorrow text,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, review_date)
);
```

## 4.11 Weekly Reviews

```sql
create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_cash numeric default 0,
  job_applications int default 0,
  followups_sent int default 0,
  actions_completed int default 0,
  biggest_win text,
  biggest_leak text,
  next_week_top_3 jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);
```

## 4.12 Audit Events

```sql
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## 4.13 Events

```sql
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id text references modules(id),
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## 4.14 Notifications

```sql
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  status text default 'unread',
  related_entity_type text,
  related_entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  read_at timestamptz
);
```

## 4.15 Documents

```sql
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text references modules(id),
  document_type text not null,
  label text not null,
  storage_path text,
  status text default 'active',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

---

# 5. Module Tables Migration

Create:

```txt
supabase/migrations/0002_module_tables.sql
```

It must create:

```txt
cash_entries
job_applications
contacts
credit_snapshots
funding_tasks
funding_documents
projects
acquisition_targets
acquisition_contacts
acquisition_scores
```

## 5.1 Cash Entries

```sql
create table if not exists cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  source text not null,
  gross_amount numeric not null default 0,
  expenses numeric not null default 0,
  net_amount numeric generated always as (gross_amount - expenses) stored,
  hours numeric,
  trips int,
  notes text,
  created_at timestamptz default now()
);
```

## 5.2 Job Applications

```sql
create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  salary_min numeric,
  salary_max numeric,
  status text default 'saved',
  priority_score int default 5,
  recruiter_name text,
  recruiter_email text,
  job_url text,
  resume_version text,
  next_action text,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 5.3 Contacts

```sql
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  contact_type text not null,
  phone text,
  email text,
  status text default 'active',
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  related_module_id text references modules(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 5.4 Credit Snapshots

```sql
create table if not exists credit_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  experian_score int,
  equifax_score int,
  transunion_score int,
  utilization_percent numeric,
  open_disputes int default 0,
  chex_status text,
  early_warning_status text,
  lexisnexis_status text,
  notes text,
  created_at timestamptz default now()
);
```

## 5.5 Funding Tasks

```sql
create table if not exists funding_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  status text default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 5.6 Funding Documents

```sql
create table if not exists funding_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  label text not null,
  storage_path text,
  status text default 'needed',
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## 5.7 Projects

```sql
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text default 'active',
  focus_level int default 5,
  revenue_potential int default 5,
  strategic_value int default 5,
  time_required int default 5,
  risk_level int default 5,
  next_action text,
  blocker text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 5.8 Acquisition Targets

```sql
create table if not exists acquisition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_type text not null,
  location text,
  asking_price numeric,
  revenue numeric,
  noi numeric,
  ebitda numeric,
  doors_count int,
  seller_financing_possible boolean default false,
  status text default 'researching',
  next_action text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 5.9 Acquisition Contacts

```sql
create table if not exists acquisition_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references acquisition_targets(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);
```

## 5.10 Acquisition Scores

```sql
create table if not exists acquisition_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references acquisition_targets(id) on delete cascade,
  cash_flow_score int default 5,
  seller_motivation_score int default 5,
  financing_score int default 5,
  upside_score int default 5,
  risk_score int default 5,
  overall_score numeric,
  notes text,
  created_at timestamptz default now()
);
```

---

# 6. RLS Requirements

Enable RLS on every user-owned table.

Use policies so users can only operate on their own records.

User-owned tables:

```txt
profiles
global_actions
module_metrics
decisions
daily_reviews
weekly_reviews
audit_events
events
notifications
documents
cash_entries
job_applications
contacts
credit_snapshots
funding_tasks
funding_documents
projects
acquisition_targets
acquisition_contacts
acquisition_scores
```

Reference tables:

```txt
empire_phases
modules
```

Authenticated users can read reference tables.

## RLS Pattern

For simple user-owned tables:

```sql
alter table table_name enable row level security;

create policy "Users can select own table_name"
on table_name for select
using (auth.uid() = user_id);

create policy "Users can insert own table_name"
on table_name for insert
with check (auth.uid() = user_id);

create policy "Users can update own table_name"
on table_name for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own table_name"
on table_name for delete
using (auth.uid() = user_id);
```

For `profiles`, use `id` instead of `user_id`.

For `decision_options` and `decision_votes`, policies must check ownership through the parent `decisions` table.

---

# 7. Seed Data

Create:

```txt
supabase/seed.sql
```

Seed:

## Empire Phases

```txt
phase_0 — Stabilize Cash
phase_1 — High-Income Role
phase_2 — Capital Stack
phase_3 — Acquire Cash Flow
phase_4 — Roll-Up
```

## Modules

```txt
cash-engine
job-hunt
followup-crm
credit-funding
projects
acquisitions
```

Do not seed private real user data.

Only seed reference data.

---

# 8. TypeScript Types

Create:

```txt
src/spine/types.ts
src/spine/actions/action.types.ts
src/spine/metrics/metric.types.ts
src/spine/decisions/decision.types.ts
src/spine/decisions/advisor.types.ts
src/spine/events/event.types.ts
src/spine/reviews/review.types.ts
```

Required shared types:

```txt
EmpirePhase
EmpireModuleRecord
ModuleManifest
GlobalAction
ModuleMetric
Decision
DecisionOption
DecisionVote
DailyReview
WeeklyReview
AuditEvent
EmpireEvent
Notification
DocumentRecord
```

Required module types:

```txt
CashEntry
JobApplication
Contact
CreditSnapshot
FundingTask
FundingDocument
Project
AcquisitionTarget
AcquisitionContact
AcquisitionScore
```

Use strict literal unions for statuses.

---

# 9. Zod Schemas

Create Zod schemas for create/update operations.

Required files:

```txt
src/spine/schemas.ts
src/spine/actions/action.schemas.ts
src/spine/metrics/metric.schemas.ts
src/spine/decisions/decision.schemas.ts
src/spine/events/event.schemas.ts
src/spine/reviews/review.schemas.ts
```

Module schemas:

```txt
src/modules/cash-engine/schemas.ts
src/modules/job-hunt/schemas.ts
src/modules/followup-crm/schemas.ts
src/modules/credit-funding/schemas.ts
src/modules/projects/schemas.ts
src/modules/acquisitions/schemas.ts
```

Validate before every database write.

---

# 10. Supabase Client Setup

Create:

```txt
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/middleware.ts
src/lib/db.ts
src/lib/result.ts
src/lib/env.ts
src/lib/dates.ts
```

`env.ts` should validate required environment variables without leaking secrets.

`result.ts` should define a clean result type:

```ts
export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };
```

---

# 11. Spine Services

Build service files.

## 11.1 Action Service

Create:

```txt
src/spine/actions/action.service.ts
```

Functions:

```txt
createAction(input)
updateAction(id, input)
completeAction(id)
getOpenActions(userId)
getRankedActions(userId)
getActionsByModule(userId, moduleId)
```

Ranking:

```txt
rank_score = impact_score + urgency_score - effort_score
```

## 11.2 Metric Service

Create:

```txt
src/spine/metrics/metric.service.ts
```

Functions:

```txt
recordMetric(input)
getTodayMetrics(userId)
getMetricsByModule(userId, moduleId)
getMetricTrend(userId, metricKey, days)
```

## 11.3 Decision Service

Create:

```txt
src/spine/decisions/decision.service.ts
```

Functions:

```txt
createDecision(input)
addDecisionOption(decisionId, input)
addAdvisorVote(decisionId, input)
getDecisionWithVotes(decisionId)
finalizeDecision(decisionId, recommendation)
```

## 11.4 Event Service

Create:

```txt
src/spine/events/event.service.ts
```

Functions:

```txt
emitEvent(input)
getEventsByModule(userId, moduleId)
getRecentEvents(userId)
recordAuditEvent(input)
```

## 11.5 Review Service

Create:

```txt
src/spine/reviews/review.service.ts
```

Functions:

```txt
createDailyReview(input)
getDailyReview(userId, date)
createWeeklyReview(input)
getWeeklyReview(userId, weekStart)
```

## 11.6 Empire Score Service

Create:

```txt
src/spine/empire-score.service.ts
```

Weights:

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
  grade: "red" | "yellow" | "green";
  breakdown: {
    cash: number;
    actions: number;
    jobHunt: number;
    followUps: number;
    review: number;
  };
};
```

---

# 12. Module Contract

Create:

```txt
src/spine/module-contract.ts
```

Every module must implement:

```ts
export type EmpireModule = {
  manifest: ModuleManifest;

  getMetrics: (userId: string) => Promise<ModuleMetric[]>;

  getActions: (userId: string) => Promise<ModuleAction[]>;

  getDecisionContext: (userId: string) => Promise<DecisionContext>;

  syncToSpine: (userId: string) => Promise<void>;

  healthCheck: (userId: string) => Promise<ModuleHealthCheck>;
};
```

Also define:

```txt
ModuleId
ModuleStatus
ModuleHealth
ModuleCapability
ModuleManifest
ModuleMetric
ModuleAction
DecisionContext
ModuleHealthCheck
```

---

# 13. Module Adapter

Create:

```txt
src/spine/module-adapter.ts
```

Functions:

```txt
syncModuleMetricsToSpine(userId, moduleId, metrics)
syncModuleActionsToSpine(userId, moduleId, actions)
recordModuleEvent(userId, moduleId, eventType, payload)
```

The adapter writes to:

```txt
module_metrics
global_actions
events
audit_events
```

Avoid duplicate actions by using stable dedupe keys inside metadata.

---

# 14. Module Registry

Create:

```txt
src/spine/module-registry.ts
```

Functions:

```txt
getAllModules()
getActiveModules()
getModuleById(moduleId)
syncAllModulesToSpine(userId)
getAllModuleMetrics(userId)
getAllModuleActions(userId)
getAllDecisionContexts(userId)
getModuleHealthReport(userId)
```

Register:

```txt
cashEngineModule
jobHuntModule
followUpCrmModule
creditFundingModule
projectsModule
acquisitionsModule
```

---

# 15. Module Folder Standard

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

For the first pass, components may be basic.

---

# 16. Required Modules

Build these modules.

## 16.1 `_template`

Path:

```txt
src/modules/_template/
```

Purpose:

Reusable standard for future modules.

Include:

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

---

## 16.2 Cash Engine

Path:

```txt
src/modules/cash-engine/
```

Purpose:

Track daily cash, expenses, targets, and runway.

Required service functions:

```txt
createCashEntry
updateCashEntry
deleteCashEntry
getCashEntryById
getTodayCash
getWeeklyCash
getMonthlyCash
getCashBySource
calculateCashGap
syncCashMetrics
createCashGapAction
```

Required metrics:

```txt
today_cash
today_cash_target
today_cash_gap
weekly_cash
monthly_cash
average_hourly_rate
average_per_trip
runway_days
```

Required actions:

```txt
Log today’s income
Earn remaining daily cash gap
Review expenses
Check weekly cash target
End day cash review
```

Required decision context:

```txt
today cash
daily target
cash gap
weekly cash
urgent cash risk
recommendation summary
```

---

## 16.3 Job Hunt

Path:

```txt
src/modules/job-hunt/
```

Purpose:

Land high-income software, AI, data, or architecture role.

Required service functions:

```txt
createJobApplication
updateJobApplication
deleteJobApplication
getJobApplicationById
getActiveJobApplications
getApplicationsByStatus
getFollowUpsDue
getHighValueOpportunities
calculatePipelineValue
syncJobMetrics
createJobFollowUpActions
```

Required metrics:

```txt
applications_today
applications_this_week
followups_due
interviews_active
pipeline_value_low
pipeline_value_high
highest_priority_job
offer_probability_estimate
```

Required actions:

```txt
Apply to high-value role
Follow up with recruiter
Prepare interview notes
Update resume
Send proposal
Record Loom demo
Review job pipeline
```

---

## 16.4 Follow-Up CRM

Path:

```txt
src/modules/followup-crm/
```

Purpose:

Manage buyers, brokers, recruiters, lenders, investors, clients, and business contacts.

Required service functions:

```txt
createContact
updateContact
deleteContact
getContactById
getContactsByType
getFollowUpsDue
getOverdueFollowUps
markContacted
createFollowUpAction
syncFollowUpMetrics
```

Required metrics:

```txt
followups_due_today
overdue_followups
hot_contacts
warm_contacts
contacts_added_this_week
response_rate
```

Required actions:

```txt
Send follow-up text
Send follow-up email
Call contact
Update contact status
Schedule next follow-up
Re-engage cold contact
```

---

## 16.5 Credit / Funding

Path:

```txt
src/modules/credit-funding/
```

Purpose:

Track credit profile, disputes, banking profile, documents, and funding readiness.

Required metrics:

```txt
funding_readiness_score
experian_score
equifax_score
transunion_score
utilization_percent
open_disputes
banking_file_status
documents_ready_count
funding_blockers_count
```

Required actions:

```txt
Mail dispute
Check bureau response
Update address
Upload document
Apply for card
Review funding readiness
Resolve banking file issue
```

---

## 16.6 Projects

Path:

```txt
src/modules/projects/
```

Purpose:

Rank and manage business projects so attention does not scatter.

Required metrics:

```txt
active_projects
parked_projects
blocked_projects
highest_focus_project
highest_upside_project
distraction_risk_score
```

Required actions:

```txt
Move project forward
Park project
Define next action
Remove distraction
Review project ranking
Ship MVP step
```

---

## 16.7 Acquisitions

Path:

```txt
src/modules/acquisitions/
```

Purpose:

Track property management companies, real estate deals, business acquisitions, seller financing, and LOIs.

Required metrics:

```txt
active_targets
targets_reviewed_this_week
seller_financing_targets
highest_score_target
average_target_score
estimated_noi_pipeline
```

Required actions:

```txt
Analyze target
Contact owner
Request financials
Score acquisition
Prepare LOI
Follow up with seller
Review financing options
```

---

# 17. AI Redaction

Create:

```txt
src/spine/ai/redaction.ts
```

Required functions:

```txt
redactText(input)
redactObject(input)
redactDecisionContext(context)
```

Never send these to external AI unredacted:

```txt
SSNs
Tax IDs
Full account numbers
Full credit report details
Bank account numbers
Private document URLs
Exact addresses unless necessary
Sensitive medical details unless explicitly requested
```

---

# 18. Decision Engine

Create:

```txt
src/spine/decisions/decision-orchestrator.ts
src/spine/decisions/local-advisors.ts
src/spine/ai/providers.ts
```

Use advisor roles:

```txt
Cash Advisor
Career Advisor
Risk Advisor
Deal Advisor
Execution Advisor
Final Judge
```

Decision output must include:

```txt
Recommendation
Confidence
Best option
Worst option
Cash impact
Time impact
Risk level
Upside level
Reasoning
Next 3 actions
Decision log
```

Support local fallback advisors first.

External LLM providers can be stubbed safely.

Do not require API keys to run the app.

---

# 19. API Routes

Create Next.js App Router route handlers.

```txt
src/app/api/actions/route.ts
src/app/api/metrics/route.ts
src/app/api/modules/sync/route.ts
src/app/api/modules/health/route.ts
src/app/api/modules/metrics/route.ts
src/app/api/modules/actions/route.ts
src/app/api/decisions/route.ts
src/app/api/empire-score/route.ts
src/app/api/reviews/route.ts
```

Each route should:

```txt
Get authenticated user
Validate input with Zod
Call service layer
Return normalized JSON
Avoid cross-user data exposure
Avoid leaking secrets
```

---

# 20. UI Requirements

After backend and modules exist, build basic UI.

## 20.1 Layout

Create:

```txt
src/app/layout.tsx
src/components/layout/AppShell.tsx
src/components/layout/Sidebar.tsx
src/components/layout/MobileNav.tsx
```

Design:

```txt
Dark premium dashboard
Black/charcoal background
Gold accents
Green for money progress
Red for overdue/risk
Large mobile-friendly buttons
Clean cards
```

## 20.2 Dashboard

Create:

```txt
src/app/dashboard/page.tsx
src/components/dashboard/
```

Dashboard must show:

```txt
Empire Score
Current Phase
Cash Today
Top 5 Ranked Actions
Follow-Ups Due
Job Hunt Progress
Module Health
Decision Alerts
Daily Review Button
```

## 20.3 Core Pages

Create:

```txt
src/app/actions/page.tsx
src/app/decisions/page.tsx
src/app/modules/cash/page.tsx
src/app/modules/jobs/page.tsx
src/app/modules/followups/page.tsx
src/app/modules/credit/page.tsx
src/app/modules/projects/page.tsx
src/app/modules/acquisitions/page.tsx
```

Do not over-polish UI before data flow works.

---

# 21. Documentation

Create or update:

```txt
README.md
README_BACKEND.md
MASTER_GUIDE.md
docs/ARCHITECTURE.md
docs/SPINE_DESIGN.md
docs/MODULE_DESIGN.md
docs/DECISION_ENGINE.md
docs/SECURITY.md
docs/RUNBOOK.md
docs/BRANCHING.md
docs/VALIDATION.md
supabase/README.md
src/modules/README.md
src/modules/_template/README.md
```

Each module README should include:

```txt
Purpose
Tables used
Metrics produced
Actions produced
Decision context produced
Events emitted
Health rules
How to extend
```

---

# 22. Validation Checklist

Before finishing, run:

```bash
npm run lint
npm run build
```

Also verify:

```txt
No Vite files
No React Router
No secrets committed
SQL migrations are valid
RLS exists on user-owned tables
Reference tables are readable
Types compile
Zod schemas match service inputs
Module registry loads
Module health checks return
Metrics sync to spine
Actions sync to spine
Decision context is redacted
API routes compile
Docs are present
```

Create:

```txt
docs/VALIDATION.md
```

Summarize:

```txt
Commands run
Results
Known issues
Next steps
```

---

# 23. Suggested Commit Plan

Use meaningful commits.

```bash
git add .
git commit -m "Initialize Next.js Empire OS foundation"

git add .
git commit -m "Add Supabase spine and module schema"

git add .
git commit -m "Add spine services and module contract"

git add .
git commit -m "Add initial modules and registry"

git add .
git commit -m "Add decision engine and AI redaction"

git add .
git commit -m "Add dashboard and module UI shell"

git add .
git commit -m "Add documentation and validation report"
```

If working on feature branches, use:

```bash
git checkout -b feature/spine-backend-v3
git checkout -b feature/module-system-v3
git checkout -b feature/decision-engine-v3
git checkout -b feature/dashboard-ui
```

---

# 24. Final Expected Output From Claude

At the end, provide a concise report:

```txt
Files created
Tables created
RLS policies added
Services created
Modules implemented
API routes added
UI pages added
Docs created
Validation results
Known limitations
Recommended next branch or next task
```

---

# 25. Build Priorities If Time Is Limited

If unable to build everything in one pass, prioritize:

```txt
1. Supabase migrations
2. RLS policies
3. Spine types/schemas/services
4. Module contract/registry/adapter
5. Cash Engine backend
6. Job Hunt backend
7. Follow-Up CRM backend
8. Empire Score
9. Decision redaction
10. Basic dashboard
```

A working backend spine is more important than a pretty UI.

---

# 26. Master Instruction

Build the repo so that Empire OS becomes a serious, extensible, secure personal operating system.

The first usable version should let the user:

```txt
Log cash
Track job applications
Track contacts/follow-ups
Create and rank actions
See module health
Calculate Empire Score
Save daily review
Ask for a structured decision
Get next actions
```

Keep the architecture clean enough that future modules can be added by copying `_template`, filling in domain logic, and registering the module.

Do not make architectural shortcuts that will break the Spine + Modules pattern.
