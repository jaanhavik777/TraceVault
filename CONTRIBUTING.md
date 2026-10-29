# Contributing (2-person team)

## Branching
- `main` is always working. Never push directly; open a pull request.
- Branch names: `feat/<area>-<name>`, e.g. `feat/auth-jaanhavi`, `feat/search-kushi`, `fix/dashboard-kushi`.
- Keep branches short-lived (a day or two) and merge often.

## Commits
- Commit from your own GitHub account so contributions are visible.
- Small, frequent commits with clear messages: `feat: add assign_incident function`, `fix: handle empty search`, `docs: add data dictionary`.

## Pull requests
- Every PR is reviewed by the other person before merging (squash or merge, your choice).
- Use the PR template. Include a screenshot for UI changes and the SQL output for DB changes.

## Ownership
See `.github/CODEOWNERS` and the OWNER comment at the top of each file. Do not edit your partner's files without telling them. Shared files: `lib/db.ts`, `API.md`, `sql/01_ddl.sql`, `sql/02_seed_base.sql`.

## Secrets
Never commit `.env.local`. Only `.env.example` (no real values) is tracked.
