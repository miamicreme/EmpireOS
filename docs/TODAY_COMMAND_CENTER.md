# Today Command Center

`/today` is the primary home experience for EmpireOS. It is an execution screen, not a generic dashboard: the first question it answers is **“What is the highest-value move today?”**

## Source of truth

- The Spine remains the priority source. `/today` starts from `getRankedActions` and only adds transparent display reasons from the existing AI prioritizer.
- Modules own detail. Cash, job hunt, follow-ups, credit/funding, projects, and acquisitions are shown as module-specific slices without duplicating module logic.
- The compact `agent_*` runtime remains the only AI action path. The command bar calls `/api/ai/agent/run`; pending drafts are read from `agent_action_drafts`.
- Kohron must approve, reject, or edit AI drafts before they become `global_actions`.

## Empty states

The page is useful with seeded or empty data: it shows what to sync or create next instead of rendering blank panels.

## Routes

- `/` redirects to `/today`.
- `/today` is the primary command page.
- `/dashboard` keeps the previous status/analytics dashboard available.
