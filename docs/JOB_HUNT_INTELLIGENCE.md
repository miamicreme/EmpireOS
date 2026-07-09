# Career Command / Job Hunt Intelligence

This document records what was extracted from the uploaded `ai-job-search-master.zip` and how it should live inside EmpireOS.

The zip is not a drop-in app for EmpireOS. It is a career-intelligence workflow package built around Claude commands, skill files, LaTeX templates, salary tooling, and a drafter-reviewer process. EmpireOS should reuse the intelligence patterns, not the shell.

## What was extracted

### 1. Fit scoring framework

The source framework evaluates a job across five dimensions:

```txt
Technical Skills Match
Experience Match
Behavioral / Culture Fit
Location & Logistics
Career Alignment & Motivation
```

EmpireOS should preserve that logic as structured fit scoring, then turn it into `priority_score`, decision facts, risks, and action drafts.

Recommended weight model:

```txt
Technical Skills: 30%
Experience Match: 25%
Behavioral Fit: 15%
Career Alignment: 30%
Location: pass/fail gate
```

Thresholds:

```txt
75+ Strong Fit
60-74 Good Fit
45-59 Moderate Fit
30-44 Weak Fit
0-29 Poor Fit
```

### 2. Drafter-reviewer application workflow

The strongest reusable pattern is not the LaTeX output. It is the sequence:

```txt
Parse job posting
Research company
Evaluate fit
Tailor resume
Draft cover letter
Reviewer critique
Verify claims
Prepare interview pack
Track outcome
```

EmpireOS should express this as agent artifacts and approval-gated actions.

### 3. Interview prep workflow

The source interview command emphasizes:

- use the exact posting and submitted resume/cover letter as context
- keep interview claims consistent with submitted documents
- prepare STAR stories
- prepare honest bridge answers for gaps
- research the company and interviewer only from verified public information
- prepare 4-6 smart questions to ask
- log outcomes after the interview to improve calibration

### 4. Outcome loop

The source workflow keeps an archive per application. EmpireOS should represent that as:

```txt
job application
  -> fit evaluation artifact
  -> resume draft artifact
  -> cover letter artifact
  -> interview prep artifact
  -> outcome note
  -> calibration insight
```

## What not to copy

Do not copy the repo shell directly:

- no LaTeX-only document pipeline as the primary EmpireOS output
- no Claude command dependency
- no local documents folder as source of truth
- no separate job tracker CSV as the main database
- no AI workflow outside EmpireOS provider routing

## EmpireOS implementation target

The job module should behave like a career command center:

```txt
Paste/upload job
  -> extract role/company/pay/requirements
  -> score fit
  -> identify strengths/gaps
  -> recommend apply/skip/call first
  -> draft resume bullets
  -> draft cover letter
  -> run reviewer pass
  -> create interview prep
  -> draft follow-up actions
  -> track outcome
```

## Current code upgrade

A pure helper was added at:

```txt
src/modules/job-hunt/intelligence.ts
```

It gives the module a first intelligence layer without changing the database schema:

- application scoring
- Strong/Good/Moderate/Weak/Poor verdicts
- pipeline intelligence
- top opportunity selection
- missing next-action detection
- missing salary detection
- drafter-reviewer checklist
- interview prep focus

The module decision context now uses this helper to tell the Spine what matters in the job pipeline.

The module metrics now include:

```txt
active_apps
interviewing
strong_fit_apps
missing_next_actions
```

## Next implementation phase

The next phase should add persistent artifacts and API routes:

```txt
POST /api/jobs/evaluate
POST /api/jobs/[id]/draft-resume
POST /api/jobs/[id]/draft-cover-letter
POST /api/jobs/[id]/review-application
POST /api/jobs/[id]/interview-prep
POST /api/jobs/[id]/outcome
```

Suggested new tables or artifact types:

```txt
job_fit_evaluation
job_resume_draft
job_cover_letter_draft
job_interview_prep
job_outcome_note
```

Preferred pattern: use existing `agent_artifacts` where possible before adding new tables.

## Guardrails

- Never invent experience.
- Do not make unverified company claims in resumes, cover letters, or interview prep.
- Any gap should be handled with the bridge pattern: acknowledge, connect adjacent proof, explain learning path.
- Reviewer pass must check for truth, fit, clarity, defensibility, and voice.
- Every active application needs an explicit next action and follow-up date.

## Manual test plan

1. Add a saved high-income role.
2. Add salary range and notes with AI/software keywords.
3. Confirm it appears as a strong or good opportunity in decision context.
4. Mark it applied without next action.
5. Confirm module health warns about missing next actions.
6. Add next action and recruiter info.
7. Mark it interviewing.
8. Confirm the top recommendation becomes interview prep.
9. Mark it offer.
10. Confirm recommendation becomes offer decision analysis.
