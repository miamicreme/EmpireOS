# Auto deploy on main updates

EmpireOS should redeploy whenever `main` changes.

Recommended setup:

1. In Render, open the `empire-os` web service.
2. Go to Settings.
3. Turn on Auto-Deploy for the connected GitHub repository.
4. Confirm the service watches branch `main`.
5. After every merge to `main`, Render will receive the GitHub update and start a new build/deploy.

Do not commit private deployment URLs, provider keys, Supabase keys, or passkey recovery codes to the repository.

## Verification

After merging any PR to `main`:

- Check GitHub commit history and confirm the merge commit is on `main`.
- Open Render and confirm a new deploy started.
- After deploy completes, open `/api/health` and `/today`.
- Confirm passkey login still works on the configured production domain.
