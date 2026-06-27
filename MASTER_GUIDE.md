# Empire OS Master Build Guide

## Version

**Empire OS Master Guide v1.0**  
Framework: **Next.js App Router + Supabase + TypeScript**  
Architecture: **Spine + Modules + AI Decision Engine**  
Build strategy: **Backend first, then module system, then UI**

---

# 1. What Empire OS Is

**Empire OS** is a private execution operating system designed to manage the full KJB Empire plan.

It is not a generic planner.

It is a personal command center that organizes:

- Daily cash
- High-income job search
- Follow-ups
- Credit and funding readiness
- Business projects
- Acquisitions
- AI-assisted decisions
- Daily and weekly accountability

The app should answer one question every day:

> What is the highest-value action I should take today to move the empire forward?

---

# 2. Core Architecture

Empire OS uses a **Spine + Modules** architecture.

```txt
Empire OS
│
├── Spine
│   ├── Auth
│   ├── Profiles
│   ├── Empire Phases
│   ├── Module Registry
│   ├── Global Actions
│   ├── Module Metrics
│   ├── Empire Score
│   ├── Decision Engine
│   ├── Events
│   ├── Audit Logs
│   ├── Notifications Foundation
│   ├── Daily Reviews
│   └── Weekly Reviews
│
└── Modules
    ├── Cash Engine
    ├── Job Hunt
    ├── Follow-Up CRM
    ├── Credit / Funding
    ├── Projects
    ├── Acquisitions
    └── Future Modules
```

## The Rule

```txt
The Spine owns priority.
Modules own domain detail.
Decisions create actions.
Actions move phases.
Phases build the empire.
```

---

# 3. Tech Stack

Use:

```txt
Framework: Next.js App Router
Language: TypeScript
Database/Auth: Supabase
Database Engine: PostgreSQL
Security: Row Level Security
Validation: Zod
Styling: Tailwind CSS
Deployment: Vercel
AI Layer: API routes + external LLM providers later
```

Do **not** use:

```txt
Vite
React Router
Untyped service calls
Unredacted AI context
Separate repos for each module
Frontend-first build
```

---

# 4. Repo Strategy

Use **one repo**.

Repo name:

```txt
Empire-OS
```

Use branches for major work.

```txt
main
└── stable production-ready code only

develop
└── integration branch

feature/spine-backend-v3
└── backend spine foundation

feature/module-system-v3
└── module contract, template, registry, module services

feature/decision-engine-v3
└── multi-LLM decision orchestration

feature/dashboard-ui
└── first frontend dashboard

feature/cash-engine-ui
└── cash module UI

feature/job-hunt-ui
└── job hunt module UI
```

Do **not** split modules into separate repos yet.

Separate repos only make sense later if:

- A module becomes a standalone product
- A module has its own customer base
- A separate team owns it
- It needs independent deployment

---

# 5. Initial Repo Setup

From PowerShell:

```bash
cd C:\__CODEDEPOT
git clone https://github.com/YOUR-GITHUB-USERNAME/Empire-OS.git
cd Empire-OS
```

Create branches:

```bash
git checkout -b develop
git push -u origin develop

git checkout -b feature/spine-backend-v3
git push -u origin feature/spine-backend-v3
```

Create Next.js app:

```bash
npx create-next-app@latest .
```

Recommended answers:

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

Install packages:

```bash
npm install @supabase/supabase-js @supabase/ssr zod date-fns
npm install -D supabase
```

Optional later:

```bash
npm install lucide-react recharts
```

Open in Cursor:

```bash
cursor .
```

---

# 6. Build Order

Do not start with UI.

Build in this order:

```txt
1. Backend Spine
2. Module System
3. Multi-LLM Decision Engine
4. Dashboard UI
5. Cash Engine UI
6. Job Hunt UI
7. Follow-Up CRM UI
8. Credit/Funding UI
9. Projects UI
10. Acquisitions UI
11. Notifications
12. Mobile/PWA polish
```

---

# 7. Backend Spine

The **Backend Spine** is the foundation.

It owns:

- Auth integration
- Profiles
- Empire phases
- Modules registry
- Global actions
- Module metrics
- Decisions
- Decision votes
- Daily reviews
- Weekly reviews
- Audit events
- Events
- Empire Score
- API route stubs
- Shared TypeScript contracts
- Shared Zod schemas

## Required Spine Tables

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

## Required Module Tables For MVP

```txt
cash_entries
job_applications
contacts
```

Later module tables:

```txt
credit_snapshots
funding_tasks
funding_documents
projects
acquisition_targets
acquisition_contacts
acquisition_scores
```

---

# 8. Empire Phases

Seed these phases:

```txt
phase_0 — Stabilize Cash
phase_1 — High-Income Role
phase_2 — Capital Stack
phase_3 — Acquire Cash Flow
phase_4 — Roll-Up
```

## Phase Logic

```txt
Phase 0:
Protect household cash flow and survival money.

Phase 1:
Land high-income software, AI, data, or architecture role.

Phase 2:
Improve credit, banking, tax records, and funding readiness.

Phase 3:
Acquire cash-flow businesses or property management companies.

Phase 4:
Scale through acquisitions, systems, and software leverage.
```

---

# 9. Module Registry

Seed these modules:

```txt
Cash Engine
High-Income Job Hunt
Follow-Up CRM
Credit / Funding
Projects
Acquisitions
```

Each module must register with:

```ts
export type ModuleManifest = {
  id: string;
  name: string;
  slug: string;
  description: string;
  phaseId: string;
  status: "active" | "light_active" | "parked" | "later" | "disabled";
  priority: number;
  route: string;
  icon?: string;
  capabilities: string[];
  version: string;
};
```

---

# 10. Global Actions

This is one of the most important parts of the app.

A task is generic.

An **action** is empire-moving.

Examples:

```txt
Finish SouthernTier proposal
Apply to 5 AI/Data roles
Earn remaining daily cash target
Follow up with buyer
Mail dispute letter
Analyze acquisition target
Send recruiter follow-up
Upload funding document
```

Every module creates actions, but the Spine ranks them.

## Action Ranking Formula

Start simple:

```txt
rank_score = impact_score + urgency_score - effort_score
```

Later, improve it with:

```txt
cash urgency
phase alignment
deadline risk
opportunity upside
stale follow-up penalty
confidence score
```

---

# 11. Module Metrics

Every module reports normalized metrics to the Spine.

Examples:

```txt
Cash Engine:
today_cash
today_cash_target
today_cash_gap
weekly_cash
monthly_cash
average_hourly_rate

Job Hunt:
applications_today
applications_this_week
followups_due
interviews_active
pipeline_value_low
pipeline_value_high

Follow-Up CRM:
followups_due_today
overdue_followups
hot_contacts
warm_contacts

Credit / Funding:
funding_readiness_score
experian_score
equifax_score
transunion_score
open_disputes
funding_blockers_count

Projects:
active_projects
parked_projects
blocked_projects
highest_focus_project
distraction_risk_score

Acquisitions:
active_targets
targets_reviewed_this_week
seller_financing_targets
estimated_noi_pipeline
```

The dashboard should not need to know each module’s database details.

It only reads normalized metrics.

---

# 12. Module Contract

Every module must implement the same contract.

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

This lets the Spine ask every module:

```txt
What metrics do you have?
What actions are due?
What decision context do you provide?
Are you healthy?
What needs attention?
```

---

# 13. Standard Module Folder

Every module should follow this exact structure:

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

For backend-first work, components can be stubs.

---

# 14. Module Template

Create a reusable module template:

```txt
src/modules/_template/
```

It must include:

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

Every future module should start by copying `_template`.

---

# 15. Initial Modules

## 15.1 Cash Engine

Purpose:

```txt
Track income, expenses, daily cash target, weekly cash target, monthly cash target, and runway.
```

Required services:

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

---

## 15.2 Job Hunt

Purpose:

```txt
Land a high-income software, AI, data, or architecture role.
```

Required services:

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

## 15.3 Follow-Up CRM

Purpose:

```txt
Manage buyers, brokers, recruiters, lenders, investors, clients, and business contacts.
```

Required services:

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

## 15.4 Credit / Funding

Purpose:

```txt
Track credit profile, disputes, banking profile, documents, and funding readiness.
```

Required tables:

```txt
credit_snapshots
funding_tasks
funding_documents
```

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

## 15.5 Projects

Purpose:

```txt
Rank and manage business projects so attention does not scatter.
```

Required table:

```txt
projects
```

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

## 15.6 Acquisitions

Purpose:

```txt
Track property management companies, real estate deals, business acquisitions, seller financing, and LOIs.
```

Required tables:

```txt
acquisition_targets
acquisition_contacts
acquisition_scores
```

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

# 16. AI Decision Engine

The Decision Engine should not be a normal chatbot.

It should be a multi-advisor system.

## Advisors

```txt
Cash Advisor
Career Advisor
Risk Advisor
Deal Advisor
Execution Advisor
Final Judge
```

## Decision Output

Every decision should return:

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

## Example Decision

Question:

```txt
Should I Uber today or work on job applications?
```

The Spine asks modules:

```txt
Cash Engine: What is today’s cash gap?
Job Hunt: Are there urgent deadlines?
Follow-Up CRM: Are there overdue contacts?
Projects: Is anything high-value blocked?
```

Final answer:

```txt
Do 2 hours of job applications first, then Uber until minimum cash target is hit.
```

---

# 17. AI Context Redaction

Never send sensitive private data to AI unless explicitly needed and approved.

Redact:

```txt
SSNs
Tax IDs
Full account numbers
Full credit report details
Private document URLs
Exact addresses unless necessary
Sensitive medical details unless explicitly requested
```

Required file:

```txt
src/spine/ai/redaction.ts
```

Required functions:

```ts
redactText(input)
redactObject(input)
redactDecisionContext(context)
```

---

# 18. Events and Audit Logs

Every meaningful module event should emit an event.

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
decision.created
decision.finalized
```

Audit events should record:

```txt
who
what
when
entity type
entity ID
summary
metadata
```

This creates accountability and traceability.

---

# 19. Module Health Checks

Every module must report health.

Examples:

```txt
Cash Engine:
Red if no income logged today and cash target not met.

Job Hunt:
Yellow if no applications this week.

Follow-Up CRM:
Red if overdue follow-ups exist.

Credit / Funding:
Yellow if no recent credit snapshot exists.

Projects:
Red if too many active projects.

Acquisitions:
Yellow if no targets reviewed this week.
```

Health statuses:

```txt
green
yellow
red
unknown
```

---

# 20. Empire Score

Create an Empire Score from 0–100.

Initial weights:

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

# 21. API Routes

Use Next.js App Router API route conventions.

Create route stubs:

```txt
src/app/api/modules/sync/route.ts
src/app/api/modules/health/route.ts
src/app/api/modules/metrics/route.ts
src/app/api/modules/actions/route.ts
src/app/api/decisions/route.ts
src/app/api/empire-score/route.ts
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

# 22. Supabase RLS

Enable Row Level Security on every user-owned table.

User-owned tables include:

```txt
profiles
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

Rules:

```txt
Users can only select their own rows.
Users can only insert their own rows.
Users can only update their own rows.
Users can only delete their own rows.
Public reference tables can be read by authenticated users.
Do not rely only on frontend filtering.
```

---

# 23. Documentation Files

Create these docs:

```txt
README.md
README_BACKEND.md
MASTER_GUIDE.md
supabase/README.md
src/modules/README.md
src/modules/_template/README.md
docs/ARCHITECTURE.md
docs/SPINE_DESIGN.md
docs/MODULE_DESIGN.md
docs/DECISION_ENGINE.md
docs/SECURITY.md
docs/RUNBOOK.md
docs/BRANCHING.md
docs/VALIDATION.md
```

---

# 24. Cursor Workflow

Use Cursor in stages.

## Stage 1 — Backend Spine

Branch:

```bash
git checkout -b feature/spine-backend-v3
```

Prompt:

```txt
Use the Backend Spine Prompt V3 High-Tech.
Build backend-first.
Do not build frontend screens.
Use Next.js App Router.
No Vite.
No React Router.
```

After done:

```bash
git add .
git commit -m "Build backend spine v3"
git push
```

Merge:

```bash
git checkout develop
git merge feature/spine-backend-v3
git push
```

## Stage 2 — Module System

Branch:

```bash
git checkout -b feature/module-system-v3
```

Prompt:

```txt
Use the Module System Prompt V3 High-Tech.
Build shared module contract, module adapter, registry, template, and backend module logic.
Do not overbuild UI.
```

After done:

```bash
git add .
git commit -m "Build module system v3"
git push
```

Merge:

```bash
git checkout develop
git merge feature/module-system-v3
git push
```

## Stage 3 — Decision Engine

Branch:

```bash
git checkout -b feature/decision-engine-v3
```

Build:

```txt
Decision orchestrator
Advisor roles
Context redaction
Decision votes
Final judge
Decision API route
Decision log
Next-action creation
```

## Stage 4 — Dashboard UI

Branch:

```bash
git checkout -b feature/dashboard-ui
```

Build:

```txt
Command dashboard
Empire Score card
Top 5 actions
Cash card
Job Hunt card
Follow-Up card
Module health cards
Decision alerts
Daily review button
```

---

# 25. Validation Checklist

Before merging any branch:

```txt
npm run lint
npm run build
SQL migration applies cleanly
RLS policies exist
No secrets committed
No Vite files
No React Router
Types compile
Zod schemas match service inputs
Module registry loads
Module health checks return
Metrics sync to spine
Actions sync to spine
Decision context is redacted
Docs updated
```

---

# 26. Git Commands

Common flow:

```bash
git status
git add .
git commit -m "Meaningful commit message"
git push
```

Switch branches:

```bash
git checkout develop
git pull
git checkout -b feature/new-feature-name
```

Merge feature into develop:

```bash
git checkout develop
git pull
git merge feature/new-feature-name
git push
```

---

# 27. Production Mindset

Build this like a real operating system.

Do:

```txt
Keep one source of truth
Keep module contracts strict
Keep services typed
Keep RLS secure
Keep AI context redacted
Keep actions ranked
Keep metrics normalized
Keep docs updated
```

Do not:

```txt
Build random screens before backend
Let modules invent their own patterns
Duplicate logic everywhere
Send private data to AI unredacted
Store secrets in code
Create separate repos too early
Overbuild before MVP is usable
```

---

# 28. MVP Definition

The MVP is complete when:

```txt
User can log in
User has profile
Empire phases are seeded
Modules are seeded
User can create global actions
Cash entries sync metrics
Job applications sync metrics
Contacts create follow-up actions
Dashboard can read normalized metrics
Empire Score can calculate
Decision context can be generated
Daily review can be saved
Weekly review can be saved
RLS protects user data
```

---

# 29. First Usable UI

The first UI should be simple:

```txt
Dashboard
Actions
Cash Engine
Job Hunt
Follow-Up CRM
Daily Review
Decision Console
```

Do not build every module UI first.

The dashboard should show:

```txt
Empire Score
Current Phase
Cash Today
Top 5 Ranked Actions
Follow-Ups Due
Job Hunt Progress
Module Health
Decision Alerts
```

---

# 30. Master Cursor Prompt

Use this if you want Cursor to understand the whole project:

```md
You are building Empire OS, a private execution operating system using Next.js App Router, TypeScript, Supabase, PostgreSQL, RLS, Zod, and Tailwind.

This app uses a Spine + Modules architecture.

The Spine owns:
- auth
- profiles
- empire phases
- module registry
- global actions
- module metrics
- decisions
- decision votes
- empire score
- events
- audit logs
- notifications foundation
- daily reviews
- weekly reviews

Modules own domain detail, but every module must report normalized metrics, global actions, decision context, events, and health checks back to the Spine.

Do not use Vite.
Do not use React Router.
Do not build random screens before the backend foundation is stable.
Do not send private data to AI unredacted.

Build in this order:
1. Backend Spine
2. Module System
3. Decision Engine
4. Dashboard UI
5. Individual module UIs

Use strict TypeScript types, Zod validation, Supabase RLS, modular services, and clear documentation.

The core rule:
The Spine owns priority. Modules own detail. Decisions create actions. Actions move phases. Phases build the empire.
```

---

# 31. Immediate Next Step

Since the repo already exists, do this now:

```bash
cd C:\__CODEDEPOT\Empire-OS
git checkout develop
git pull
git checkout -b feature/spine-backend-v3
```

Then open Cursor:

```bash
cursor .
```

Paste the **Backend Spine Prompt V3 High-Tech** first.

After the backend spine is done and merged, create:

```bash
git checkout -b feature/module-system-v3
```

Then paste the **Module System Prompt V3 High-Tech**.

Do not start the UI until both are done.
