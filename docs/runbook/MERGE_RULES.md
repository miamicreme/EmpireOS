# Empire OS Merge Rules

## Purpose

These rules define how Empire OS branches move into `develop` and `main`.

Empire OS uses a safe integration workflow:

```txt
feature branches -> develop -> validate -> main
```

Do not skip `develop`.

---

## Core Rule

```txt
main is stable.
develop is integration.
feature branches are for work in progress.
```

`main` should only receive code after it has been merged into `develop` and validated.

---

## Branch Roles

### `main`

Stable branch only.

Use for:

- Production-ready code
- Validated releases
- Clean working versions

Do not use `main` for active build work.

### `develop`

Integration branch.

Use for:

- Combining feature branches
- Resolving conflicts
- Running build/lint checks
- Preparing code for `main`

### `feature/spine-backend-v3`

Backend spine work.

Use for:

- Supabase migrations
- RLS policies
- Core services
- Spine types/schemas
- Action/metric/decision/review services
- Next.js backend foundation

### `feature/module-system-v3`

Module system work.

Use for:

- Module contract
- Module registry
- Module adapter
- `_template` module
- Cash Engine
- Job Hunt
- Follow-Up CRM
- Credit/Funding
- Projects
- Acquisitions
- Module health checks

### `feature/decision-engine-v3`

Decision engine work.

Use for:

- Multi-advisor decision orchestration
- AI provider stubs
- Local fallback advisors
- Decision logs
- Context redaction

### `feature/dashboard-ui`

UI work.

Use for:

- Dashboard shell
- Action cards
- Module cards
- Decision console UI
- Daily/weekly review UI

---

## Required Merge Order

When backend and module branches both exist, merge in this order:

```txt
1. feature/spine-backend-v3 -> develop
2. Validate develop
3. feature/module-system-v3 -> develop
4. Validate develop again
5. develop -> main only after validation passes
```

Do not merge `feature/module-system-v3` directly into `main`.

Do not merge `feature/spine-backend-v3` directly into `main`.

Do not merge old `feature/spine-backend` into `main`; it only contains early docs and is superseded by the v3 branches.

---

## Why This Matters

`feature/spine-backend-v3` and `feature/module-system-v3` may diverge.

If they are diverged, direct merges into `main` can create conflicts, lost work, duplicate files, or broken imports.

`develop` exists to catch those issues before they reach `main`.

---

## Safe Merge Commands

### Step 1 — Merge backend spine into develop

```bash
git checkout develop
git pull origin develop
git merge feature/spine-backend-v3
npm install
npm run build
npm run lint
git push origin develop
```

### Step 2 — Merge module system into develop

```bash
git checkout develop
git pull origin develop
git merge feature/module-system-v3
npm install
npm run build
npm run lint
git push origin develop
```

### Step 3 — Merge develop into main only after validation

```bash
git checkout main
git pull origin main
git merge develop
npm install
npm run build
npm run lint
git push origin main
```

---

## GitHub Desktop Flow

1. Switch to `develop`.
2. Choose **Branch -> Merge into current branch**.
3. Select `feature/spine-backend-v3`.
4. Resolve conflicts if any.
5. Commit merge.
6. Push `develop`.
7. Still on `develop`, merge `feature/module-system-v3`.
8. Resolve conflicts if any.
9. Commit merge.
10. Push `develop`.
11. Run local validation.
12. Only then merge `develop` into `main`.

---

## Validation Before Main

Before merging into `main`, run:

```bash
npm install
npm run build
npm run lint
```

Also confirm:

```txt
No Vite files
No React Router
No secrets committed
Supabase migrations exist
RLS policies exist
Types compile
Module registry loads
Module actions/metrics sync to spine
Decision context redaction exists
Docs are updated
```

---

## Rule Summary

```txt
Feature branches are where work happens.
Develop is where work gets combined.
Main is only for validated stable code.
```

The current safe path is:

```txt
feature/spine-backend-v3
        ↓
develop
        ↓
feature/module-system-v3
        ↓
develop
        ↓
validate
        ↓
main
```
