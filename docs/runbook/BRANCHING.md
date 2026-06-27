# Branching Strategy

## Long-lived branches

- `develop` — integration branch. All organized documentation and merged feature
  work lands here. This is the base for feature branches.

## Feature branches (cut from `develop`)

- `feature/spine-backend-v3` — backend spine
- `feature/module-system-v3` — module system
- `feature/decision-engine-v3` — AI decision engine
- `feature/dashboard-ui` — dashboard UI (after backend)

## Workflow

1. Branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<name>
   ```
2. Commit focused changes with clear messages.
3. Push and open a PR back into `develop`.
4. Keep `develop` green; do not build frontend before the backend spine exists.

## Build order (which branch, when)

1. Repo/docs organization → `develop`
2. Backend spine → `feature/spine-backend-v3`
3. Module system → `feature/module-system-v3`
4. Decision engine → `feature/decision-engine-v3`
5. Dashboard UI → `feature/dashboard-ui`

## Note on this setup work

The documentation organization itself was prepared on the working branch
`claude/empire-os-repo-setup-9eehjp` and is merged into `develop` via pull request.
