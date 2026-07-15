# EmpireOS VNext — Backend Risk Register

Status: initial Program 0 risk baseline. Severity reflects production impact, not code style.

| ID | Risk | Severity | Evidence / current state | Required treatment |
| --- | --- | --- | --- | --- |
| R-001 | Multiple AI entry points can drift into separate runtimes | Critical | Agent, chief-of-staff, recommendations, module helpers, recorder processing, and universal input all exist | Define one authoritative Empire orchestration path; keep capability adapters behind it |
| R-002 | AI can appear successful while operating in stub mode | Critical | Some provider and analysis services contain deterministic fallback behavior | Replace synthetic success with typed `capability_unavailable` results and visible configuration requirements |
| R-003 | Governed Tool Gateway coverage is incomplete | Critical | Initial registered tools exist, but many backend operations still use feature-specific code | Register every executable operation with schema, risk, permission, approval, timeout, idempotency, and verification contracts |
| R-004 | Approval coverage is not yet universal | Critical | Exact-operation approvals exist for the first VNext write, but all writes are not normalized | Require immutable approvals bound to owner, tool, version, argument hash, expiry, and single use |
| R-005 | CI and branch protection are not yet proven as merge gates | High | GitHub Actions exists, but required checks and branch protection are not confirmed | Require install, typecheck, lint, tests, build, migration checks, and security contracts before merge |
| R-006 | Long-running work can block HTTP handlers | High | Recorder transcription/translation/analysis and large input analysis use route-driven processing | Move long-running capability work to durable jobs with progress, cancellation, retries, and dead-letter handling |
| R-007 | Global provider order is not capability-aware | High | Text providers and LM Studio share a general chain while speech is separate | Route per capability and enforce adapter compatibility, health, budgets, and circuit breakers |
| R-008 | Direct database writes may bypass module boundaries | High | Not fully inventoried; repository contains many route and service families | Generate write map; require module repository/service or Spine-owned service for every write |
| R-009 | Event history is distributed and may not form one operational ledger | High | System events, agent events, action transitions, provider activity, Empire runs, and tool receipts use separate shapes | Normalize trace IDs and append-only records across runs, tools, approvals, jobs, modules, and providers |
| R-010 | File security verification is incomplete | High | MIME and size validation exist in areas, but magic-byte and quarantine coverage are not yet proven globally | Centralize intake validation, magic-byte checks, safe filename/path handling, quarantine state, and malware-scan hook |
| R-011 | Prompt injection can influence planning through uploaded evidence | High | Universal input feeds model context; full instruction/evidence separation is not yet proven | Tag external content untrusted, isolate evidence from authority, limit tools, validate all arguments, and test indirect injection |
| R-012 | Memory can become incorrect or poisoned | High | Memory CRUD exists, but source/confidence/validity and mutation policy need normalization | Add sourced memory records, suggestion/approval rules, correction, dispute, supersession, and forget controls |
| R-013 | Module failure can degrade global decision quality silently | Medium | Safe fanout avoids total failure, but degraded context quality needs explicit surfacing | Include degraded-module evidence in Empire plans and prevent high-confidence recommendations when critical modules are unavailable |
| R-014 | Provider health UI uses placeholders rather than measured telemetry | Medium | Latency/failure/cost fields can be null or static | Persist provider attempts and calculate latency, failures, circuit state, and estimated cost from actual runs |
| R-015 | Database migration and RLS verification are not enforced in CI | High | Migrations and policies exist, but deployment gate is not proven | Add migration lint/apply test and owner/cross-user RLS integration suite |
| R-016 | Security-sensitive local provider URL handling can regress | Medium | LM Studio private-host validation recently caused a deploy type error | Isolate and unit-test URL policy, DNS assumptions, IPv4/IPv6 ranges, redirects, and deployment behavior |
| R-017 | UI complexity exposes infrastructure instead of outcomes | High | Current page-centric experience surfaces many cards, modules, statuses, and provider details | Replace primary UX with Today, Empire, Capture, Work, History; move system control to admin settings |
| R-018 | Contract tests may verify source text rather than behavior | High | Repository includes file-content contract tests in addition to functional tests | Retain contract tests only as guardrails; add executable service, API, RLS, queue, E2E, and security tests |
| R-019 | External side effects may lack idempotency and receipts | Critical | Full external-write inventory is not complete | Require idempotency keys, exact approval, postcondition verification, and operation receipts for every external write |
| R-020 | No production SLO/error budget currently governs Empire behavior | Medium | Performance and reliability targets are documented but not enforced | Define measured SLOs for acknowledgement, tool execution, job completion, availability, duplicate writes, and unauthorized writes |

## Immediate stop-ship conditions

The following block production expansion until resolved:

```txt
unapproved high-risk write
cross-user data access
public sensitive storage
silent stub success
arbitrary model-selected tool execution
missing authorization on write route
duplicate external side effect
failed production build
```

## First remediation sequence

1. Add CI and stop using Render as the first compiler.
2. Replace stub-success contracts with explicit unavailable results.
3. Generate route/write/storage/RLS inventory.
4. Expand Tool Gateway contracts across modules.
5. Expand exact-operation Approval Engine coverage.
6. Normalize trace IDs and operation receipts.
7. Move recorder processing to durable jobs.
8. Complete the first end-to-end Empire read and governed-write vertical slice.
