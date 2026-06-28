# Decision Engine Runbook

## Branch

Work branch:

```bash
git checkout feature/decision-engine-implementation
```

Base branch used for this implementation:

```txt
main
```

After validation, merge through `develop` before `main` according to the merge rules.

---

## What Was Implemented

The decision engine now has a runnable backend pipeline:

```txt
Decision -> Context -> Redaction -> Advisor Panel -> Final Judge -> Finalized Decision -> Optional Actions
```

Core files:

```txt
src/spine/decisions/decision-orchestrator.service.ts
src/spine/decisions/advisor.types.ts
src/spine/decisions/decision.service.ts
src/spine/decisions/context-redaction.service.ts
src/spine/ai/provider.ts
src/spine/ai/advisor-prompts.ts
src/app/api/decisions/[decisionId]/analyze/route.ts
docs/architecture/DECISION_ENGINE.md
```

---

## API Usage

Create a decision first:

```http
POST /api/decisions
```

Then analyze it:

```http
POST /api/decisions/:decisionId/analyze
```

Request body:

```json
{
  "createActions": true
}
```

When `createActions` is true, advisor `next_actions` are converted into Spine Global Actions.

---

## Environment Variables

The system chooses providers in this order:

```txt
Anthropic -> OpenAI -> Google -> stub
```

Optional keys:

```txt
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

If no provider key is available, the stub provider runs so the pipeline can still be tested.

---

## Validation Commands

Run:

```bash
npm install
npm run build
npm run lint
npm run typecheck
```

If `npm run lint` fails because the Next.js lint command is unavailable, update the lint script before merging.

---

## Expected Behavior

A valid draft decision should:

1. Move from `draft` to `analyzing`.
2. Run Cash, Career, Risk, Deal, and Execution advisors.
3. Persist each advisor vote in `decision_votes`.
4. Run Final Judge.
5. Persist Final Judge vote.
6. Move the decision to `decided`.
7. Store recommendation, confidence, risk level, and upside level.
8. Optionally create Global Actions from advisor next actions.

---

## State Protections

The orchestrator rejects analysis if the decision is already:

```txt
analyzing
decided
archived
```

This prevents duplicate votes, race conditions, and overwriting finalized decisions.

---

## Redaction Protections

The redaction layer blocks or redacts sensitive values before any external AI call:

```txt
SSNs
EINs
full account/card numbers
IBANs
emails
phone numbers
```

If a high-risk secret is detected, the analysis is blocked with `redaction_blocked`.

---

## Next Recommended Step

After validation passes, merge this branch into `develop`:

```bash
git checkout develop
git pull origin develop
git merge feature/decision-engine-implementation
npm run build
npm run lint
npm run typecheck
git push origin develop
```

Then start:

```bash
git checkout -b feature/dashboard-ui-implementation
```
