# Empire OS V3 — No-Friction Agent Runtime

The agent should feel like a smart operator, not a form-heavy app.

## User Experience Standard

The user should be able to type short commands like:

```txt
What today?
Find cash.
Fix my credit path.
Analyze this deal.
Should I trade this?
Who do I follow up with?
Draft the next moves.
Save that.
```

The system should infer what is needed and only interrupt when truly blocked.

## No-Friction Rules

```txt
Ask fewer questions.
Use existing context first.
Ask at most two memory questions when memory is missing.
Ask for research access only when current facts materially change the answer.
Draft actions instead of making the user manually retype them.
Offer Approve All / Edit / Reject controls.
Never make the user choose models, providers, or technical modes.
```

## One Command Surface

Use one primary command entry point:

```txt
POST /api/ai/agent/run
```

All AI pages and widgets should call the same agent runtime.

Specialized pages may pass hints, but they should not create separate AI systems.

Examples:

```txt
/ai/chat             -> /api/ai/agent/run with mode_hint = chat
/ai/brief            -> /api/ai/agent/run with mode_hint = daily_brief
/modules/cash        -> /api/ai/agent/run with module_hint = cash-engine
/modules/acquisitions-> /api/ai/agent/run with module_hint = acquisitions
```

## Smart Defaults

The agent should pick defaults automatically:

```txt
simple text/drafting      → fast_path
normal planning           → standard_path
money/trading/deals/legal → deep_path or research_required
current facts             → research_required
missing durable context   → memory_required
irreversible action       → approval_required
```

## Low-Churn Controls

Use lightweight controls instead of new pages for every function.

```txt
Approve drafted actions
Dismiss recommendation
Save as memory
Request research
Use deeper analysis
Show sources
Show why
```

## Prevent User Churn

Do not make the user bounce between screens.

The answer should include:

```txt
final recommendation
why it matters
top action drafts
missing data only if needed
research/source note if used
one-click next moves
```

## Fast Feel

Return something useful quickly.

For deep runs:

```txt
1. Save run as queued/running.
2. Return quick acknowledgement + expected path.
3. Stream or poll updates.
4. Save final artifact.
5. Show drafted actions.
```

Do not freeze the UI while deep analysis runs.

## No Model Picker for the User

The user should not have to choose:

```txt
provider
model
temperature
runtime mode
specialist list
context size
```

The Provider Router handles that.

Only expose simple controls:

```txt
Fast answer
Go deeper
Use current research
Draft actions
```

## Approval Without Friction

Action approval should be one click.

```txt
Approve All
Approve Selected
Edit then Approve
Reject
```

Approved action drafts become Spine `global_actions`.

## Final Standard

The system is no-friction when the user can type one short command and get:

```txt
answer
reason
sources if needed
action drafts
approval controls
saved artifact
```

without understanding the internal architecture.
